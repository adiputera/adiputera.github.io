---
layout: article
title: "Designing a Decision-as-a-Service Platform"
description: "The design constraints and trade-offs behind a Drools-based decisioning platform with a JSON-to-DRL DSL, ~30 operators, universal and existential quantifiers, multi-object grouping, and Kafka-driven hot-reload — so business teams can ship rules without backend engineers in the loop."
date: 2026-06-17
date_modified: 2026-06-17
keywords: "Decision-as-a-Service, Drools, DSL design, system design, architecture design, Quarkus, Java 25, Kafka, database, Kubernetes, microservices, decisioning engine, business rules"
permalink: /case-studies/decision-as-a-service
category: case-study
tags: [drools, java, microservices]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "Decision-as-a-Service"
snippet: "The design constraints and trade-offs behind a two-service Decision-as-a-Service platform with a custom JSON-to-DRL DSL — so business teams can ship rules without backend engineers in the loop."
snippet_id: "Constraint dan trade-off desain di balik platform Decision-as-a-Service dua-layanan dengan DSL JSON-to-DRL kustom — agar tim bisnis bisa merilis aturan baru tanpa harus melibatkan engineer backend."
published: true
---

> **Disclaimer:** The Decision-as-a-Service codebase is internal company work and is not public. This case study covers the architecture and the design trade-offs I made, with company-specific names and rule examples sanitized.

## The Design Problem

Across the platforms I work on, every new business rule followed the same loop. A business team would describe what they wanted, a backend engineer would translate it into a POJO fact class and an action handler, the rule got hard-coded into a service, and the next release window would push it to production. A rule change — even a value tweak — was a code change that needed a release.

Different teams had started building their own Drools integrations, each with the same general shape but drifting independently. Engineering was quietly becoming the bottleneck for what were really business decisions.

The problem wasn't that rules were hard to write. The problem was that the system design made every rule change a software delivery event.

## Design Constraints

Four constraints shaped every subsequent decision:

- No code change to the platform itself is needed for a new rule — not a new fact type, not a new operator, not a new action shape. The consuming team still builds whatever client surface makes sense for them — a CMS, a backoffice tool, an internal admin page — and that client defines the attributes, types, and rule shapes for their domain. The platform provides the API; the client team decides how to use it.
- The platform stays small and boring — one job, done well.
- The read path (high evaluation traffic) must scale independently from the write path (occasional authoring).

That last constraint ended up shaping the whole architecture.

## Core Design: Read/Write Separation

The read and write sides of a rules platform want fundamentally different things from their runtime. Authoring is low volume and write-heavy — a person clicking through a form. Evaluation is high volume and stateless, called on every relevant request from consuming services.

Giving them the same deployment means the autoscaler, the failure domain, and the resource profile are all shared. That's the wrong trade-off for something where the read side might need ten pods and the write side needs one.

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

**The Publishing Service** owns the rule CRUD API, compiles JSON rule definitions into Drools' DRL on publish, stores the source-of-truth in a database, and saves the compiled DRL payload alongside it. After every publish or unpublish, it emits a Kafka event.

**The Evaluation Service** loads the compiled DRL payloads from the database on startup, listens to the Kafka topic, and when a publish event arrives it rebuilds its in-memory rule set and atomically swaps it in. No restart. No request drops. Every pod holds its own copy of the rule set, so horizontal scaling on Kubernetes is just a replica count.

One deliberate design choice here: the Evaluation Service pods are **not** in a Kafka consumer group. Each pod has its own independent consumer that receives every message on the topic. This is the opposite of the usual pattern where you partition work across consumers — here, every replica needs to know about every publish event so it can rebuild its own in-memory rule set. If you used a consumer group, only one pod would get the event, and the rest would serve stale rules until the next restart.

Publishing a rule saves the new DRL to the database and emits a Kafka event. Every Evaluation Service pod picks up the event, rebuilds its in-memory rule set by querying the database, and atomically swaps it in. Requests in flight finish against the old set; new requests use the new one. End-to-end, from clicking publish to the rule being live on every pod, is usually a few seconds. From the business side, this is what "as a service" means — they click publish and it's live.

The Publishing Service can crash and the Evaluation Service keeps serving. They share a Kafka topic and a database, and that's it.

## The DSL Design

The design constraint that drove the DSL was: **no backend change per new rule**. That means the platform can't model your domain — no Java types for User, Transaction, or Document on the server side. The moment you model the domain into the engine, every new business concept needs backend work to teach the engine about it.

So facts come in as generic `{ type, attributes }` records, and rules reference fields by name.

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
  "condition": {
    "operator": "AND",
    "children": [
      { "object": "User", "attribute": "accountStatus",
        "operator": "EQUAL", "value": "ACTIVE" },
      {
        "operator": "OR",
        "children": [
          { "object": "Transaction", "attribute": "amount",
            "operator": "MORE_THAN", "value": 10000 },
          { "object": "Transaction", "attribute": "riskScore",
            "operator": "MORE_THAN", "value": 80 }
        ]
      }
    ]
  },
  "action": { "status": "FLAGGED", "reason": "High value or high risk transaction" }
}
```

Every node is either a logical operator (`AND`, `OR`) with children, or a leaf condition with an object, attribute, operator, and value. The nesting can go as deep as the rule requires. There are no Java types to model, no schema to migrate when a new attribute shows up, and no DRL to write by hand.

The action is opaque JSON. The platform doesn't interpret it — the client chooses the shape that fits the consuming service. It might be `"allow"`, `{ "riskLevel": "HIGH" }`, `{ "discount": 15 }`, or a nested structure. As long as it's valid JSON, the engine returns it untouched. This keeps the platform's scope narrow: it decides, it doesn't act.

### Compiling JSON to DRL

In Drools, rules are split into a "When" condition (the Left-Hand-Side or LHS) and a "Then" action (Right-Hand-Side or RHS). Natively, the engine is built to perform LHS pattern matching against strongly-typed Java POJOs loaded in memory. Because the platform must remain domain-agnostic, it can't use standard Java classes for facts.

Instead, the Publishing Service translates the JSON DSL by bypassing standard pattern matching altogether. All incoming facts are passed into the engine wrapped in a single, generic `Map`. The compiler flattens the JSON tree into a complex boolean expression wrapped in a single Drools `eval()` block. It leans entirely on a custom Java utility class to safely handle missing keys, nested property extraction, type coercion, and operator logic at runtime. If the `eval()` block resolves to true, the Right-Hand-Side (RHS) of the rule simply appends the opaque JSON action to an `_actions` list within the fact map. 

This approach trades away some of Drools' built-in Rete network optimizations for object matching, but it fulfills the most critical design constraint: the engine can evaluate any domain's rules without ever needing a Java class to model that domain.

### Operators

There are about 30 operators across 8 categories. The set is small enough that authors can learn it, big enough that I haven't needed to add a new one in months.

| Category | Operators |
|----------|-----------|
| Logical | `AND`, `OR` |
| Equality | `EQUAL`, `NOT_EQUAL`, `EQUALS_IGNORE_CASE`, `OBJECT_EQUALS` |
| Comparison | `MORE_THAN`, `LESS_THAN`, `MORE_THAN_OR_EQUAL`, `LESS_THAN_OR_EQUAL` |
| Collection | `IN`, `NOT_IN` |
| Null/Empty | `NULL`, `NOT_NULL`, `EMPTY`, `NOT_EMPTY` |
| String | `CONTAINS`, `NOT_CONTAINS`, `STARTS_WITH`, `ENDS_WITH`, `MATCHES`, `NOT_MATCHES` |
| Type | `NUMERIC`, `NOT_NUMERIC`, `TRUE`, `NOT_TRUE` |
| Validation | `VALID_EMAIL`, `NOT_VALID_EMAIL`, `VALID_DATE`, `VALID_DATE_TIME`, `NOT_VALID_DATE_TIME` |

Each operator declares its own coercion rules. The author never models types — the operator handles coercion internally.

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

This means rule authors don't need to coordinate with callers about cardinality. The engine adapts.

### Rule Lifecycle

A rule goes through a simple state machine:

```
  CREATE → published=false    PUBLISH → published=true    UPDATE → hasPendingChanges=true    PUBLISH → synced
```

The `hasPendingChanges` flag tracks whether a published rule has been edited since its last publish. This gives authors a safe workflow: they can iterate on a rule without affecting what's live, then explicitly publish when ready. Unpublishing removes the DRL and notifies the Evaluation Service to rebuild without it.

Rules can also carry `startDate` and `endDate` fields for time-bounded validity — temporary access grants, compliance windows, or promotional campaigns that should only fire during a specific period.

### Multi-Tenant Isolation

Each consuming application gets its own `appName`. Rules, DRL files, and Kafka topics are scoped by this identifier. Two applications sharing the same platform never see each other's rules. The isolation is at the data level, not just at the API level.

## Evaluation API

Once a rule is published, calling code sends facts and gets back actions. The engine returns a decision payload, not side effects.

```json
{
  "factAttributes": [
    { "type": "User", "attributes": { "accountStatus": "ACTIVE" }},
    { "type": "Transaction", "attributes": {
      "amount": 15000,
      "riskScore": 45,
      "country": "SG"
    }}
  ]
}
```

If the rule matches, the response is:

```json
{
  "actions": [
    { "status": "FLAGGED", "reason": "High value or high risk transaction" }
  ]
}
```

The caller decides what to do with the action. The engine never reaches out to apply it.

## Key Design Decisions

### Why Drools?

There are many ways to evaluate rules, from simple database-backed expressions to building a custom AST evaluator. I chose Drools for one fundamental reason: it supports dynamic compilation and hot-reloading at runtime. 

By feeding Drools a dynamically generated DRL string (compiled from our JSON DSL), the Evaluation Service can rebuild its entire knowledge base and swap it into the active session atomically. This means every condition, threshold, and logical operator can be completely rewritten on the fly. The engine never requires a deployment, a restart, or a single line of Java code to be changed when a business rule is added or updated.

### Why Two Services and Not One

This follows directly from the constraints. The two sides want different scaling profiles, different failure domains, and different resource budgets. Splitting them lets each have its own Kubernetes deployment and its own autoscaler. The Publishing Service can crash and the Evaluation Service keeps serving.

If they were one service, scaling for evaluation traffic would also scale the authoring side (wasted resources), and a bug in the authoring code path could take down the evaluation path (wrong failure domain).

### Why Kafka and Not Database Polling

Once the services were split, the Evaluation pods needed a way to know when rules changed. The simplest approach would be database polling: have every Evaluation pod query the database every minute to check if the rules had been updated. I avoided this for two reasons:

1. **Wasted Database I/O at Scale:** The Evaluation Service is designed to scale horizontally to handle high traffic. If 30 or 50 pods are all polling the database every few seconds just to check a `last_updated` timestamp, it generates constant, unnecessary read operations—even when rules haven't changed in weeks.
2. **The "As-a-Service" Latency:** If the polling interval is extended to 60 seconds to save database load, a business user clicking "Publish" has to wait up to a minute for their rule to go live. Kafka pushes the event instantly. The pods sit passively, and when a publish event arrives, they rebuild their rules immediately. This fulfills the promise of a true "as a service" experience: they click publish, and it's live across all nodes in seconds.

### Why It Only Decides, It Doesn't Execute

The Evaluation Service returns a JSON decision payload. It does not perform the action. The caller is responsible for what to actually do with the result.

It would have been easy to let rules trigger HTTP callbacks or emit follow-up Kafka messages — "the rule fires AND the engine performs the action." I didn't.

The reason is rooted in the concept of pure functions: a decision engine should calculate an answer without mutating the world. For example, if the engine's action was to make an HTTP call to grant a user a 20% discount code, a simple network timeout and HTTP retry from the caller could cause the engine to fire the action twice, giving the user two discount codes. By keeping the engine completely stateless and side-effect free, clients can safely retry their evaluation requests as many times as they need. The engine just evaluates the data and returns a decision; the caller owns the responsibility of safely executing the result.

The smaller scope is a feature, not a limitation.

### Why the Engine Doesn't Know Your Domain

This is the invariant that makes "no backend per new rule" actually true. There are no Java types for User, Transaction, or Document on the server side. Facts come in as generic `{ type, attributes }` records and rules reference fields by name.

The moment you model the domain into the engine, every new business concept needs backend work to teach the engine about it. Keeping the engine generic moves all the domain knowledge to the client side, where it belongs anyway.

The trade-off is that the author has to think in attribute names rather than typed classes. In practice, that's exactly how a non-engineer already thinks about a rule — "if the user's account status is ACTIVE" rather than "if User.getAccountStatus() equals AccountStatus.ACTIVE."

## The Stack

Quarkus 3 on Java 25 for both services, Drools 10 for the rule engine, a database for the authoring store, Kafka for the publish event bus, Kubernetes for deployment, OAuth2 client_credentials with short-lived JWTs for auth.

I picked Quarkus over Spring Boot for fast startup and low memory footprint — both matter for the Evaluation Service, which is the tier that scales horizontally.

## What the Design Enables

- The central platform team is no longer a bottleneck for business rules. The business team owns the logic and the platform owns the runtime. Any backend development is strictly localized to the client applications when they need to expose new data attributes to the engine.
- Platforms that used to maintain their own Drools integration now consume one shared platform.
- Because the DSL is entirely domain-agnostic, the engine can be used for *any* scenario that requires a decision — fraud detection, dynamic pricing, access control, routing logic, or promotional campaigns. The platform doesn't care; it just evaluates facts against conditions and returns the configured action.
- For existing domains, a rule change goes from "release ticket, code change, deploy window" to "click publish, wait a few seconds." When a completely new domain arrives, the development effort shifts entirely to the client side — they define their own schema and build their UI, while the platform requires zero changes.

## Final Thoughts

This platform is small by design. It does one job — take facts, return decisions — and it does that job in a way that scales independently of the authoring side. It doesn't try to be a workflow engine. It doesn't try to be an action router. It doesn't try to be a feature flagging system.

The constraints drove the shape: read/write separation because the traffic profiles are different, a domain-agnostic DSL because the platform can't afford to know your business objects, opaque actions because the engine's job ends at the decision. Every design choice traces back to one of the four constraints. When a platform is this small, that traceability is what keeps it from scope-creeping into something it shouldn't be.
