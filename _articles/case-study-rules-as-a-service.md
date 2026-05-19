---
layout: article
title: "Rules-as-a-Service: A Two-Service Decisioning Platform with a Custom DSL"
description: "How I built a Drools-based decisioning platform with a JSON-to-DRL DSL, ~30 operators, universal and existential quantifiers, multi-object grouping, and Kafka-driven hot-reload - so business teams can ship new rules without backend engineers in the loop."
date: 2026-05-23
date_modified: 2026-05-23
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

Across the platforms I work on, every new business rule used to follow the same loop. A business team would describe what they wanted, a backend engineer would translate it into a POJO fact class and an action handler, the rule got hard-coded into a service, and the next release window would push it to production. A rule change - even a value tweak - was a code change that needed a release.

After watching some platforms deploy their own Drools integration with the same general shape, my manager pitched the idea: this wanted to be a platform, not a per-project utility. He had the vision - one platform shared across teams - and handed me the technical brief. Different teams maintaining separate Drools integrations for different rulesets, and engineering quietly turning into the bottleneck for what were really business decisions.

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

The action is just JSON. The platform doesn't interpret it - the client chooses the shape that fits the consuming service. It might be a simple string like `"allow"`, an object like `{ "discount": 15, "message": "..." }`, or a nested structure. As long as it's valid JSON, the engine returns it untouched.

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

Each operator declares its own coercion rules. The author never models types - the operator does.

### Quantifiers Over Lists

A condition can reach into a list using one of two suffixes:

- `items[].price` - every item's price must satisfy the condition (universal).
- `items[?].category` - at least one item must satisfy it (existential).

Same idea, two different scopes. The notation works recursively through nested objects (`addresses[].city`, `items[?].variants[].sku`).

### Multiple Facts of the Same Type

If the caller sends multiple facts of the same type in one evaluation, the platform groups them into an array automatically:

| Notation | Behaviour |
|----------|-----------|
| `product` | Single-object evaluation. Uses the last one if more were sent. |
| `product[]` | All products must match. |
| `product[?]` | At least one product must match. |

## A Simple Evaluation

Once a rule is published, calling code sends facts and gets back actions. The engine returns a decision payload, not side effects.

```http
POST /rules/check
{
  "factAttributes": [
    { "type": "Customer", "attributes": { "membershipLevel": "GOLD" }},
    { "type": "Cart", "attributes": {
      "items": [
        { "price": 8000000, "category": "Electronics" },
        { "price": 500000, "category": "Fashion" }
      ]
    }}
  ]
}
```

If the rule above matches, the response is:

```json
{
  "actions": [
    { "discount": 15, "message": "Premium member with valid cart" }
  ]
}
```

The caller decides what to do with the action. The engine never reaches out to apply it.

## Three Decisions I'd Defend

### Why Two Services and Not One

The two sides want very different things from their runtime. Authoring is low volume and write-heavy - a person clicking through a form. Evaluation is high volume and stateless, called from a handful of consuming services on every relevant request.

Splitting them lets each have its own AKS deployment, its own autoscaler, and its own failure domain. The Publishing Service can crash and the Evaluation Service keeps serving. They share a Kafka topic and a filesystem, and that's it.

### Why It Only Decides, It Doesn't Execute

The Evaluation Service returns a JSON decision payload. It does not perform the action. The caller is responsible for what to actually do with the result.

It would have been easy to let rules trigger HTTP callbacks or emit follow-up Kafka messages - "the rule fires AND the rule does the thing." I didn't.

The reason is the same one Open Policy Agent (OPA) and most well-designed authorization systems take: keep the policy engine pure. If the platform performs side effects, a Kafka redelivery could fire the side effect twice. A retry from a caller could fire it twice. None of those are problems if the engine just returns a decision and the caller is the one with the responsibility.

The smaller scope is a feature, not a limitation.

### Why the Engine Doesn't Know Your Domain

There are no Java types for Customer, Product, or Cart on the server side. Facts come in as generic `{ type, attributes }` records and rules reference fields by name.

This was the invariant that made "no backend per new rule" actually true. The moment you model the domain into the engine, every new business concept needs backend work to teach the engine about it. Keeping the engine generic moves all the domain knowledge to the client side, where it belongs anyway.

The trade-off is that the author has to think in attribute names rather than typed classes. In practice that's exactly how a non-engineer already thinks about a rule.

## Hot-Reload

Publishing a rule writes the new DRL to the shared filesystem and emits a Kafka event. Every Evaluation Service pod picks up the event, rebuilds its in-memory rule set from disk, and atomically swaps it in. Requests in flight finish against the old set; new requests use the new one.

End-to-end, from clicking publish to the rule being live on every pod, is usually a few seconds. No restart, no deploy window. From the business side, this is what "as a service" means - they click publish and it's just live.

## The Stack

Quarkus 3 on Java 25 for both services, Drools 10 for the rule engine, MongoDB for the authoring store, Kafka for the publish event bus, AKS for deployment, OAuth2 client_credentials with short-lived JWTs for auth.

I picked Quarkus over Spring Boot for fast startup and low memory footprint - both matter for the Evaluation Service, which is the tier that scales horizontally.

## What It Changed

- Backend engineers are no longer in the loop for a new business rule. The business team owns the rule, the platform owns the runtime.
- Platforms that used to maintain their own Drools integration now consume one.
- A rule change goes from "release ticket, code change, deploy window" to "click publish, wait a few seconds." That difference in posture matters more than the time saved.

## Final Thoughts

The thing I keep coming back to is that this platform is small. It does one job - take facts, return decisions - and it does that one job in a way that scales independently of the authoring side. It doesn't try to be a workflow engine. It doesn't try to be an action router. It doesn't try to be a feature flagging system.

When I see a platform team building something for the third time and the second one is already starting to drift, that's usually the sign the thing wants to be its own service. Pulling it out and giving it a clean DSL surface is a lot more work up front than copy-pasting it would have been, but every team using it gets the next feature for free. That's the math that makes a shared platform worth the up-front cost.
