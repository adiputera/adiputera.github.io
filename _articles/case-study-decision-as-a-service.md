---
layout: article
title: "Designing a Decision-as-a-Service Platform"
description: "The design constraints and trade-offs behind a two-service decisioning platform with a custom JSON-to-DRL DSL and Kafka-driven hot-reload, allowing business teams to ship rules without backend deploys."
date: 2026-06-17
date_modified: 2026-06-19
keywords: "Decision-as-a-Service, Drools, DSL design, system design, architecture design, Quarkus, Java 25, Kafka, database, Kubernetes, microservices, decisioning engine, business rules"
permalink: /case-studies/decision-as-a-service
category: case-study
tags: [drools, java, microservices]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "Decision-as-a-Service"
snippet: "The design constraints and trade-offs behind a two-service Decision-as-a-Service platform with a custom JSON-to-DRL DSL — so business teams can ship rules without engineers in the loop."
snippet_id: "Constraint dan trade-off desain di balik platform Decision-as-a-Service dua-layanan dengan DSL JSON-to-DRL kustom — agar tim bisnis bisa merilis aturan baru tanpa harus melibatkan engineer."
image: /images/articles/case-study-decision-as-a-service/cover.webp
og_image_width: 1024
og_image_height: 1024
og_image_type: image/webp
published: true
---

> **Disclaimer:** The Decision-as-a-Service codebase is internal company work and is not public. This case study covers the architecture and the design trade-offs I made.

## The Design Problem

Across the platforms I work on, every new business rule followed the same loop. A business team would describe what they wanted, a backend engineer would translate it into a Java class and an action handler, the rule got hard-coded into a service, and the next release window would push it to production. A rule change — even a value tweak — was a code change that needed a release.

Different teams had started building their own Drools integrations, each with the same general shape but drifting independently. Engineering was quietly becoming the bottleneck for what were really business decisions.

The problem wasn't that rules were hard to write. The problem was that the system design made every rule change a software delivery event.

## Design Constraints

Three constraints shaped every subsequent decision:

- No code change to the platform itself is needed for a new rule within the existing operator set — not a new fact type, not a new action shape. The consuming team still builds whatever client application makes sense for them — a CMS, a backoffice tool, an internal admin page — and that client defines the attributes, types, and rule shapes for their domain. The platform provides the API; the client team decides how to use it.
- The platform stays small and boring — one job, done well.
- The read path (high evaluation traffic) must scale independently from the write path (occasional authoring).

That last constraint ended up shaping the whole architecture.

## Core Design: Read/Write Separation

The read and write sides of a rules platform want fundamentally different things from their runtime. Authoring is stateful and user-driven — a person clicking through a form. Evaluation is stateless and machine-driven, called on every relevant request from consuming services.

Giving them the same deployment means the autoscaler is shared, they share the same CPU/memory, and if one crashes, they both go down. That's the wrong trade-off for something where the read side might need ten pods and the write side needs one.

So the platform is two Quarkus services with Kafka in the middle:

```
+-----------------------+        Kafka         +----------------------+
|   Publishing Service  |  ───────────────▶   |  Evaluation Service  |
|                       |    publish event    |                      |
|   - Rule CRUD         |                     |   - Stateless eval   |
|   - JSON → DRL        |                     |   - In-memory rules  |
|   - Database storage  |                     |   - Hot-reload       |
+-----------------------+                     +----------------------+
        │                                             ▲
        │   writes DRL payload                        │ reads
        └────────────────►   Shared Database   ◄──────┘
```

**The Publishing Service** owns the API for managing rules, compiles JSON rule definitions into Drools' DRL on publish, stores the source of truth in a database, and saves the compiled DRL payload alongside it. After every publish or unpublish, it emits a Kafka event.

**The Evaluation Service** loads the compiled DRL payloads from the database on startup, listens to the Kafka topic, and when a publish event arrives it rebuilds its in-memory rule set and swaps it in. No restart. Every pod holds its own copy of the rule set, so horizontal scaling on Kubernetes is just a replica count.

One deliberate design choice here: the Evaluation Service pods do not share a **Kafka consumer group**. Each pod spins up with a uniquely generated consumer group ID so it receives every message on the topic. To avoid replaying the entire topic history on startup, new pods configure their consumers to start from the latest offset, relying entirely on the database for their initial state. This is the opposite of the usual pattern where work is partitioned across consumers — here, every replica needs to know about every publish event so it can rebuild its own in-memory rule set. If they shared a single consumer group, only one pod would get the event, and the rest would serve stale rules until the next restart.

Publishing a rule saves the new DRL to the database and emits a Kafka event identifying the changed application. Every Evaluation Service pod picks up the event, rebuilds the global rule set by querying the database, and swaps it in. Requests in flight finish against the previous rule set; new requests use the rebuilt set. End-to-end, from clicking publish to the rule being live on every pod, is usually a few seconds. From the business side, this is what "as a service" means — the author clicks publish and it's live.

The Publishing Service can crash and the Evaluation Service keeps serving. They communicate via Kafka and share a database, and that's it.

## The DSL Design

The DSL is designed to map a business user's mental model into a structured JSON tree, avoiding the need for authors to write syntax-heavy DRL by hand.

To understand the DSL, start with what a rule looks like in plain language:

```
User.accountStatus = "ACTIVE"
AND
(Transaction.amount > 10000 OR Transaction.riskScore > 80)
```

This is a tree. The root operator is `AND`, with two children:

```
AND
├── User.accountStatus = "ACTIVE"
└── OR
    ├── Transaction.amount > 10000
    └── Transaction.riskScore > 80
```

The first child is a leaf condition — one object, one attribute, one operator, one value. The second child is itself a subtree with `OR` as its operator and two leaf conditions underneath. The DSL maps this tree directly into JSON:

```json
{
  "startDate": "2026-01-01T00:00:00Z",
  "endDate": "2026-12-31T23:59:59Z",
  "condition": {
    "operator": "AND",
    "children": [
      { 
        "object": "User", 
        "attribute": "accountStatus",
        "operator": "EQUAL", 
        "value": "ACTIVE" 
      },
      {
        "operator": "OR",
        "children": [
          { 
            "object": "Transaction", 
            "attribute": "amount",
            "operator": "MORE_THAN", 
            "value": 10000 
          },
          { 
            "object": "Transaction", 
            "attribute": "riskScore",
            "operator": "MORE_THAN", 
            "value": 80 
          }
        ]
      }
    ]
  },
  "action": { 
    "status": "FLAGGED", 
    "reason": "High value or high risk transaction" 
  }
}
```

Every node is either a logical operator (`AND`, `OR`) with children, or a leaf condition with an object, attribute, operator, and value. The nesting can go as deep as the rule requires. There are no Java types to model, no schema to migrate when a new attribute shows up, and no DRL to write by hand.

The action is arbitrary JSON. The platform doesn't interpret it — the client chooses the shape that fits the consuming service. It might be `"allow"`, `{ "riskLevel": "HIGH" }`, `{ "discount": 15 }`, a nested structure, or even a list. As long as it's valid JSON, the engine returns it untouched. This keeps the platform's scope narrow: it decides, it doesn't act.

### Compiling JSON to DRL

In Drools, rules are split into a "When" condition (the Left-Hand-Side or LHS) and a "Then" action (Right-Hand-Side or RHS). Natively, the engine is built to perform LHS pattern matching against strongly-typed Java POJOs loaded in memory. Because the platform must remain domain-agnostic, it can't use standard Java classes for facts.

Instead, the Publishing Service translates the JSON DSL by bypassing standard pattern matching for the dynamic payload. All incoming facts are passed into the engine wrapped in a single, generic `Map`. The compiler flattens the JSON tree into a complex boolean expression wrapped in a single Drools `eval()` block. 

To ensure the engine can still optimize evaluations, structural metadata—like the rule's optional `startDate` and `endDate` boundaries—are injected as real pattern constraints *outside* the `eval()` block:

```drools
rule "Rule_123"
when
    $fact : Map( 
        this["date"] >= 1767225600000L, // 2026-01-01T00:00:00Z
        this["date"] <= 1798761599000L  // 2026-12-31T23:59:59Z
    )
    eval( evaluateComplexJsonTree($fact) )
then
    // Append arbitrary JSON action
end
```

Before the engine evaluates a request, the Evaluation Service parses the incoming ISO-8601 date string into epoch milliseconds and injects it as `date` into the root `$fact` map. This ensures Drools can perform fast numeric comparisons without string parsing overhead. If the `eval()` block resolves to true, the Right-Hand-Side (RHS) of the rule simply appends the arbitrary JSON action to an `_actions` list within the fact map.

This approach trades away some of Drools' built-in Rete network optimizations for object matching, but it meets the most critical design constraint: the engine can evaluate rules from various domains without ever needing a Java class to model that domain.

### Operators

There are 32 operators across 8 categories. The set is small enough that authors can learn it, big enough that I haven't needed to add a new one in months.

| Category | Operators |
|----------|-----------|
| Logical | `AND`, `OR` |
| Equality | `EQUAL`, `NOT_EQUAL`, `EQUALS_IGNORE_CASE`, `OBJECT_EQUALS` |
| Comparison | `MORE_THAN`, `LESS_THAN`, `MORE_THAN_OR_EQUAL`, `LESS_THAN_OR_EQUAL` |
| Collection | `IN`, `NOT_IN` |
| Null/Empty | `NULL`, `NOT_NULL`, `EMPTY`, `NOT_EMPTY` |
| String | `CONTAINS`, `NOT_CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `MATCHES`, `NOT_MATCHES` |
| Type | `NUMERIC`, `NOT_NUMERIC`, `TRUE`, `NOT_TRUE` |
| Validation | `VALID_EMAIL`, `NOT_VALID_EMAIL`, `VALID_DATE`, `NOT_VALID_DATE`, `VALID_DATE_TIME`, `NOT_VALID_DATE_TIME` |

Each operator declares its own coercion rules. The author does not explicitly model types — the operator handles coercion internally.

### Quantifiers Over Lists

A condition can reach into a list using one of two suffixes:

- `items[].price` — every item's price must satisfy the condition (universal).
- `items[?].category` — at least one item must satisfy it (existential).

Same idea, two different scopes. The notation works recursively through nested objects (`addresses[].city`, `items[?].variants[].sku`).

### Multiple Facts of the Same Type

If the caller sends multiple facts of the same type in one evaluation, the platform groups them into an array automatically:

| Notation | Behaviour |
|----------|-----------|
| `product` | Single-object evaluation. Uses the last one if more were sent. |
| `product[]` | All products must match. |
| `product[?]` | At least one product must match. |

The system handles mismatches between rule expectations and evaluation data gracefully:

| Rule Expects | Data Sent | Behaviour |
|-------------|-----------|-----------|
| Single (`product`) | 1 product | Direct evaluation |
| Single (`product`) | 2+ products | Uses the last product |
| Array (`product[]` / `product[?]`) | 1 product | Wraps as single-element array |
| Array (`product[]` / `product[?]`) | 2+ products | Evaluates as array |

This means rule authors don't need to coordinate with callers about cardinality. The engine adapts. However, silently evaluating only the last object when multiple are sent to a single-object rule is a deliberate compatibility trade-off to prevent evaluation failures. Client engineers must be aware that array ordering becomes semantic in this edge case, and they should ideally align their payload shapes with the rule's expectations — after all, it is the client team itself that authors the rules for its domain.

### Rule Lifecycle

A rule goes through a simple state machine:

```
CREATE    → published=false, hasPendingChanges=false
PUBLISH   → published=true,  hasPendingChanges=false
UPDATE    → published=true,  hasPendingChanges=true
PUBLISH   → published=true,  hasPendingChanges=false
UNPUBLISH → published=false, hasPendingChanges=false
```

The `hasPendingChanges` flag tracks whether a published rule has been edited since its last publish. This gives authors a safe workflow: they can iterate on a rule without affecting what's live, then explicitly publish when ready. Unpublishing deletes the compiled DRL (while keeping the JSON definition intact) and notifies the Evaluation Service to rebuild without it.

Rules can also carry optional `startDate` and `endDate` fields for time-bounded validity — temporary access grants, compliance windows, or promotional campaigns that should only fire during a specific period. If these fields are not provided, the engine simply skips the temporal boundary checks. Because these bounds are compiled as real pattern constraints outside the `eval()` block (as shown earlier), activation and expiry are enforced dynamically at evaluation time without requiring scheduled rebuild events.

### Multi-Tenant Isolation

Each consuming application gets its own `appName`. Rules and DRL files are scoped by this identifier. The engine strictly scopes evaluations to that specific application, meaning two tenants sharing the same platform never see each other's rules. The isolation is at the data level, not just at the API level.

A major design tension in this multi-tenant architecture is how to hold the rules in memory. There are two viable strategies:

1. **Multiple Knowledge Bases:** The Evaluation Service maintains a `Map<String, KieBase>`. When an app publishes a rule, only that app's `KieBase` is rebuilt. This provides fast, targeted hot-reloads and strict isolation, but holding dozens of separate `KieBases` consumes significant heap space.
2. **Single Global Knowledge Base:** The engine maintains one massive `KieBase` for all tenants. Every DRL rule is injected with an `appName == "X"` condition before the `eval()` block (as a real pattern constraint, identical to the date boundaries shown earlier). This keeps tenant filtering outside the expensive dynamic `eval()` block. This is highly memory-efficient, but introduces a "noisy neighbor" reload penalty: if one app publishes a rule, the engine has to burn CPU to rebuild the entire global knowledge base.

We opted for the **Single Global Knowledge Base**. Because the platform currently serves a small number of consuming applications and a manageable volume of total rules, the CPU penalty for rebuilding the entire base is negligible. Memory efficiency took precedence over targeted hot-reloads. As the number of onboarded tenants grows, the architecture can gracefully migrate to multiple knowledge bases if reload times ever become an issue.

## Evaluation API

Once a rule is published, calling code sends facts and gets back actions. The tenant's `appName` is securely extracted from the caller's OAuth2 JWT token to enforce isolation, so the client only needs to pass the facts themselves. The payload also accepts an optional `date` field. If omitted, the Evaluation Service defaults to the current server time. Allowing the client to explicitly override the evaluation time is a deliberate choice: it fully empowers the calling application to manage its own temporal context, enabling idempotent batch processing or safely evaluating rules against historical data without needing a separate administrative endpoint. The engine returns a decision payload, not side effects.

```json
{
  "date": "2026-06-15T10:00:00Z",
  "factAttributes": [
    { 
      "type": "User", 
      "attributes": 
        { 
          "accountStatus": "ACTIVE" 
        }
    },
    { 
      "type": "Transaction", 
      "attributes": 
        { 
          "amount": 15000,
          "riskScore": 45,
          "country": "SG"
        }
    }
  ]
}
```

If the rule matches, the response is:

```json
{
  "actions": 
    [ 
      { 
        "status": "FLAGGED", 
        "reason": "High value or high risk transaction" 
      }
    ]
}
```

The caller decides what to do with the action. The engine never reaches out to apply it.

## Key Design Decisions

### Why Drools?

There are many ways to evaluate rules, from simple database-backed expressions to building a custom logic engine. I chose Drools because it provides a mature DRL compiler, safe rule packaging, and dynamic knowledge-base replacement at runtime. 

By feeding Drools a dynamically generated DRL string (compiled from the JSON DSL), the Evaluation Service can rebuild the application's knowledge base and swap it into the active session atomically. This means every condition, threshold, and logical operator can be completely rewritten on the fly. The engine does not require a deployment, a restart, or a single line of Java code to be changed when a business rule is added or updated.

### Why It Only Decides, It Doesn't Execute

The Evaluation Service returns a JSON decision payload. It does not perform the action. The caller is responsible for what to actually do with the result.

It would have been easy to let rules trigger HTTP callbacks or emit follow-up Kafka messages — "the rule fires AND the engine performs the action." I didn't.

There are two reasons for this. First, it preserves the domain-agnostic design. The moment the engine is responsible for performing an action—like calling a Payment API or sending an email—it suddenly needs to know about external domains, credentials, and API contracts. By simply returning a decision, it remains decoupled.

Second, it makes evaluations safely retriable. If the engine's action was to make an HTTP call to grant a user a 20% discount code, a simple network timeout and HTTP retry from the caller could cause the engine to fire the action twice, giving the user two discount codes. By ensuring the engine only calculates a decision without mutating any state, clients can safely retry their evaluation requests as many times as they need. The engine just evaluates the data and returns a decision; the caller owns the responsibility of safely executing the result.

The smaller scope is a feature, not a limitation.

### Why the Engine Doesn't Know the Domain

This is the invariant that makes "no engine updates per new rule" actually true. There are no Java types for User, Transaction, or Document on the engine side. Facts come in as generic `{ type, attributes }` records and rules reference fields by name.

The moment a domain is modeled into the engine, every new business concept needs code changes to teach the engine about it. Keeping the engine generic moves all the domain knowledge to the client side, where it belongs anyway.

The trade-off is that the author has to think in attribute names rather than typed classes. In practice, that's exactly how a non-engineer already thinks about a rule — "if the user's account status is ACTIVE" rather than "if User.getAccountStatus() equals AccountStatus.ACTIVE."

### Failure Handling

Because the system relies on asynchronous Kafka events and dynamic compilation, failure domains are mostly contained and recoverable:

- **Compilation Failures:** The Publishing Service validates the JSON DSL and attempts a dry-run DRL compilation before saving the compiled DRL payload. If it fails, the API rejects the request. Bad rules never reach Kafka.
- **Missed Events:** If an Evaluation pod crashes or misses an event, it simply rebuilds its entire state from the database on startup. 
- **Rebuild Failures:** If a pod receives an event but fails to rebuild its knowledge base, it gracefully aborts the swap and simply continues serving the previous valid rule set.
- **Publishing Dual-Write Gap:** Saving the DRL to the database and emitting the Kafka event is a dual-write operation. If the database write succeeds but the Kafka publish fails, pods serve stale rules until the next publish event, a pod restart, or a manual trigger of the Evaluation Service's reload API. While a Transactional Outbox pattern would guarantee delivery, this gap is accepted as a known residual risk given the current operational volume and the availability of the manual reload fallback.

## Alternative Architectures Considered

### 1. Dropping the Database (Shared File System Distribution)

In a file-system architecture, the database can be stripped out entirely. The Publishing Service saves the authoring source of truth as a `.json` file and compiles the result into a `.drl` file directly on a shared drive (like AWS EFS or an NFS mount). The Evaluation pods mount that same drive. When a publish event arrives via Kafka, the Evaluation pods simply read the new `.drl` file from their local mount instead of querying a database.

I opted against a shared file system primarily to avoid the operational headaches of managing shared network volumes across multiple availability zones in Kubernetes. There's also the risk of partial reads if the Evaluation pod tries to load the file before the network mount has fully synced the write. A database is a predictable managed dependency that keeps the application pods stateless.

### 2. Dropping Kafka (Poll-Based Reloads)

If Kafka were dropped, the Evaluation pods would need another way to know when rules change. If the database was kept, every pod would have to poll it every minute. If a shared file system was used instead, the system could rely on directory watching or polling. I avoided polling entirely for three reasons:

- **Wasted I/O at Scale:** The Evaluation Service is designed to scale horizontally to handle high traffic. More pods means more read operations—polling a database every few seconds just to check a `last_updated` timestamp generates constant, unnecessary I/O, even when rules haven't changed in weeks.
- **The "As-a-Service" Latency:** If the polling interval is extended to 60 seconds to save database load, a business user clicking "Publish" has to wait up to a minute for their rule to go live. Kafka pushes the event within milliseconds. The pods sit passively, and when a publish event arrives, they begin rebuilding their rules. This creates a true "as a service" experience: the author clicks publish, and it's live across all nodes in seconds.
- **Inconsistent Rollouts:** Because pods poll independently on their own timers, there is a guaranteed window where different pods serve different versions of the rules. Replica 1 might poll and load the new rule immediately, while Replica 10 continues evaluating against the old rule until its next polling cycle hits.

## The Stack

Quarkus 3 on Java 25 for both services, Drools 10 for the rule engine, a database for the authoring store, Kafka for the publish event bus, Kubernetes for deployment, OAuth2 client_credentials with short-lived JWTs for auth.

I picked Quarkus over Spring Boot for fast startup and low memory footprint — both matter for the Evaluation Service, which is the tier that scales horizontally.

## What the Design Enables

- Platform engineering is no longer a bottleneck for new business rules. The business team owns rule authoring and the platform owns the runtime. A platform engineer is only needed to add new operators, which is very rare since the current set is comprehensive. Any backend development is strictly localized to the client applications when they need to expose new data attributes to the engine.
- Platforms that used to maintain their own Drools integration now consume one shared platform.
- Because the DSL is entirely domain-agnostic, the engine can be used for a wide variety of scenarios that require a decision — fraud detection, dynamic pricing, access control, routing logic, or promotional campaigns. The platform doesn't care; it just evaluates facts against conditions and returns the configured action.
- For existing domains, a rule change goes from "release ticket, code change, deploy window" to "click publish, wait a few seconds." When a completely new domain arrives, the development effort shifts entirely to the client side — the client team defines their own schema and builds their UI, while the platform requires no changes.

## Final Thoughts

This platform is small by design. It does one job — take facts, return decisions — and it does that job in a way that scales independently of the authoring side. It doesn't try to be a workflow engine. It doesn't try to be an action router. It doesn't try to be a feature flagging system.

The constraints drove the shape: read/write separation because the traffic profiles are different, a domain-agnostic DSL because the platform can't afford to know specific business objects, arbitrary actions because the engine's job ends at the decision. Every design choice traces back to one of the three constraints. When a platform is this small, that traceability is what keeps it focused on doing one job well.
