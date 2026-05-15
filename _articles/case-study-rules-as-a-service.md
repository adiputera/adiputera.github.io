---
layout: article
title: "Rules-as-a-Service: A Two-Service Decisioning Platform with a Custom DSL"
description: "How I built a Drools-based decisioning platform with a JSON-to-DRL DSL, ~30 operators, universal and existential quantifiers, multi-object grouping, and Kafka-driven hot-reload - so business teams can ship new rules without backend engineers in the loop."
date: 2026-05-13
date_modified: 2026-05-13
keywords: "Rules-as-a-Service, Drools, DSL design, Quarkus, Java 25, Kafka, MongoDB, AKS, microservices, decisioning engine, business rules"
permalink: /case-studies/rules-as-a-service
category: case-study
tags: [drools, java, microservices]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "Rules-as-a-Service"
snippet: "How I built a two-service Rules-as-a-Service decisioning platform with a custom JSON-to-DRL DSL - so business teams can ship new rules without backend engineers in the loop."
snippet_id: "Bagaimana saya membangun platform Rules-as-a-Service dua-layanan dengan DSL JSON-to-DRL kustom - agar tim bisnis bisa merilis aturan baru tanpa harus melibatkan engineer backend."
published: false
---

> **Disclaimer:** The Rules-as-a-Service codebase is internal company work and is not public. This case study covers the architecture and the design trade-offs I made along the way, with the company-specific names and rule examples sanitized.

## The Background

Across the commerce platforms I work on, every new business rule used to follow the same loop. A business team would describe what they wanted, a backend engineer would translate it into a POJO fact class and an action handler, the rule got hard-coded into a service, and the next release window would push it to production. A rule change - even a value tweak - was a code change with a release attached to it.

After watching three different platforms each rebuild their own Drools integration with the same general shape, I started to think this wanted to be a platform, not a per-project utility. Three teams paying the same tax, three near-identical codebases drifting apart, and engineering quietly turning into the bottleneck for what were, fundamentally, business decisions.

So I designed one.

## What I Wanted

A platform where:

- A non-engineer can author a rule, hit publish, and see it live in seconds.
- No backend code change is needed to add a new rule.
- The platform itself stays small and boring - one job, done well.
- It scales for the read path (high evaluation traffic) independently from the write path (occasional authoring).

That last point ended up shaping the whole thing.

## The Two-Service Split

The platform is two Quarkus services with Kafka in the middle:

```
+-----------------------+        Kafka         +----------------------+
|   Publishing Service  |  ───────────────▶   |  Evaluation Service  |
|                       |    publish event    |                      |
|   - Rule CRUD         |                     |   - Stateless eval   |
|   - JSON → DRL        |                     |   - In-memory rules  |
|   - MongoDB storage   |                     |   - Hot-reload       |
+-----------------------+                     +----------------------+
        │                                             ▲
        │   writes DRL files                          │ reads
        └────────────────►  Shared filesystem  ◄──────┘
```

**The Publishing Service** is the writer side. It owns the rule CRUD API, compiles the JSON rule definition into Drools' DRL on publish, stores the source-of-truth in MongoDB, and writes the compiled DRL out to a shared filesystem. After every publish or unpublish, it emits an event on Kafka so the other side knows to refresh.

**The Evaluation Service** is the reader side. It loads DRL files from the shared filesystem on startup, listens to the Kafka topic, and when a publish event arrives it rebuilds its in-memory rule set and atomically swaps it in. No restart. No request drops. Every pod runs the same code and holds its own copy of the rule set, so I can scale them out horizontally on AKS based on evaluation traffic without thinking about coordination.

Splitting it this way was the most important call I made, and I'll come back to why.

## The JSON DSL

The thing that makes this platform usable for non-engineers is the JSON DSL. A rule looks like this:

```json
{
  "condition": {
    "operator": "AND",
    "children": [
      { "object": "Customer", "attribute": "membershipLevel",
        "operator": "IN", "value": ["GOLD", "PLATINUM"] },
      { "object": "Cart", "attribute": "items[].price",
        "operator": "MORE_THAN", "value": 0 }
    ]
  },
  "action": { "discount": 15, "message": "Premium member with valid cart" }
}
```

There are no Java types to model, no schema to migrate when a new attribute shows up, and no DRL to write by hand. The author thinks in conditions and actions; the compiler thinks in DRL.

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

Each operator declares its own coercion rules. `EQUAL` accepts anything. Comparison operators parse operands as numbers. Validation operators have their own format contracts. The author never models types - the operator does.

### Quantifiers Over Lists

A condition can reach into a list using one of two suffixes:

- `items[].price` - every item's price must satisfy the condition (universal).
- `items[?].category` - at least one item must satisfy it (existential).

Same idea, two different scopes. The notation reads naturally once you've seen it twice, and it works recursively through nested objects (`addresses[].city`, `items[?].variants[].sku`).

### Multiple Facts of the Same Type

If the caller sends multiple facts of the same type in one evaluation, the platform groups them into an array automatically. The rule then chooses what to do with the array:

| Notation | Behaviour |
|----------|-----------|
| `product` | Single-object evaluation. Uses the last one if more were sent. |
| `product[]` | All products must match. |
| `product[?]` | At least one product must match. |

A premium-customer-with-electronics-purchase rule looks like this:

```json
{ "operator": "AND", "children": [
  { "object": "Customer", "attribute": "membershipLevel",
    "operator": "IN", "value": ["GOLD", "PLATINUM"] },
  { "object": "Product[?]", "attribute": "category",
    "operator": "EQUAL", "value": "Electronics" },
  { "object": "Product[]", "attribute": "price",
    "operator": "MORE_THAN", "value": 0 }
] }
```

It reads almost like English, and it compiles to DRL the author never has to see.

## Three Decisions I'd Defend

### Why Two Services and Not One

I said earlier this was the most important call. Here's why.

The two sides of the platform want very different things from their runtime. Authoring is low volume and write-heavy - a person clicking through a form. Evaluation is high volume and stateless - hot path, called from a handful of consuming services on every relevant request.

If I put them in one service, every authoring spike would compete with production evaluation traffic for the same JVM. The MongoDB driver, the Drools engine, the request handlers - everything shared. And worse, the deploy story would be coupled: every authoring feature would force a redeploy of the evaluation tier, which is the one I most want to keep stable.

Splitting them lets each have its own AKS deployment, its own HPA, and its own failure domain. The Publishing Service can crash and the Evaluation Service keeps serving. The Evaluation Service can scale to ten pods without thinking about whether MongoDB connections will saturate. They share a Kafka topic and a filesystem, and that's it.

### Why It Only Decides, It Doesn't Execute

The Evaluation Service returns a JSON decision payload. It does not perform the action. The caller is responsible for what to actually do with the result.

This was a deliberate scope choice. It would have been easy to let rules trigger HTTP callbacks or emit follow-up Kafka messages - "the rule fires AND the rule does the thing." I didn't.

The reason is the same one OPA and most well-designed IAM systems use: keep the policy engine pure. If the platform performs side effects, then a Kafka redelivery could fire the side effect twice. A retry from a caller could fire it twice. A rule change at the wrong moment could fire the wrong side effect. None of those are problems if the engine just returns a decision and the caller is the one with the responsibility.

The trade-off is that callers carry more code. They have to interpret the decision payload. I think that's the right place for it - the caller already has the context, the auth, the database connection, and the observability for whatever it's doing. The engine doesn't.

A less experienced version of the platform would have tried to do both and shipped something half-built. The smaller scope is a feature, not a limitation.

### Why I Store Operands as Strings

This one is the most "huh, why?" decision in the codebase. Operand values in the rule store are canonical strings, regardless of the JSON type the author wrote.

Yes, this gives up some compile-time type safety. The cost is real: I can't tell at write time whether `MORE_THAN "abc"` is a programming mistake.

What I get for that cost is twofold. First, adding a new operator is purely additive - I don't need a schema migration to introduce one that takes a new value shape. Second, each operator owns its own input contract and parses what it needs at evaluation time. A parse failure returns a typed evaluation error to the caller. I never throw in the middle of a rule.

The author doesn't model types. The operator does. That has held up across the whole operator set.

## Hot-Reload Without a Restart

When the Publishing Service publishes or unpublishes a rule, four things happen in order:

1. The new DRL file is written to the shared volume.
2. A Kafka event lands on the topic the Evaluation Service is listening to.
3. Every Evaluation Service pod picks up the event, rebuilds its in-memory rule set from the filesystem, and atomically swaps it in.
4. Requests already in flight finish against the old rule set. New requests use the new one.

End-to-end, from clicking publish to the new rule being live across every pod, is usually a few seconds. No restart, no deploy window, no request drops. This is the part that earns the platform its name from the business side - they click publish and it's just live.

## The Rest of the Plumbing

A few things that aren't headline features but matter once it's in production:

- **Auth.** OAuth2 client_credentials with short-lived JWTs (5 minutes). A custom `@Secured` annotation enforces permission-based authorization at each endpoint, not broad roles. That comes up later in the platform's life when someone wants to give a team read-only access to one rule set without inventing a whole new role for it.
- **Correlation IDs.** Threaded through every request via a filter, propagated to downstream calls and Kafka events. When an auth failure or a rule evaluation goes wrong, one ID stitches the story together across both services.
- **Error envelope.** Every error response is `{ "errors": [{ "type": "...", "message": "..." }] }`, with a typed `type` discriminator. Clients can switch on the type rather than parse English. Boring, but it makes the consuming services much easier to write.
- **Kubernetes health probes.** Liveness, readiness, and a readiness check that verifies the Drools engine is operational and rules are loaded. AKS handles the rest.

## The Stack

| Layer | Choice |
|-------|--------|
| Runtime | Quarkus 3 / Java 25 |
| Rule engine | Drools 10 |
| Authoring store | MongoDB, with custom `JsonNode` codecs |
| Event bus | Apache Kafka |
| Deployment | Docker images on Azure Kubernetes Service (AKS) |
| Auth | OAuth2 client_credentials, JWT bearer tokens |

I picked Quarkus over Spring Boot for fast startup and low memory footprint - both matter for the Evaluation Service, which is the tier that scales horizontally on AKS.

## What It Changed

- Backend engineers are no longer in the loop for a new business rule. The business team owns the rule, the platform owns the runtime.
- Three platforms that used to maintain their own Drools integration now consume one.
- A rule change goes from "release ticket, code change, deploy window" to "click publish, wait a few seconds." That difference in posture matters more than the time saved.

## Final Thoughts

The thing I keep coming back to is that this platform is small. It does one job - take facts, return decisions - and it does that one job in a way that scales independently of who's authoring rules. It doesn't try to be a workflow engine. It doesn't try to be an action router. It doesn't try to be a feature flagging system.

When I see a platform team building something for the third time and the second one is already starting to drift, that's usually the sign the thing wants to be its own service. Pulling it out and giving it a clean DSL surface is a lot more work up front than copy-pasting it would have been, but the compounding payoff - every team using it gets the next feature for free - is what keeps the engineering org from collapsing under its own weight.
