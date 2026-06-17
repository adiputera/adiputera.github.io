---
layout: article
title: "SAP Commerce Monolith → Spring Boot Microservices: An Ongoing Modernization"
description: "How I'm migrating three SAP Commerce platforms into a Spring Boot microservices ecosystem, with shared platform capabilities so each domain team isn't reinventing the same primitives."
date: 2026-05-13
date_modified: 2026-05-13
keywords: "SAP Commerce modernization, Spring Boot microservices, strangler fig, event-driven architecture, platform engineering, monolith decomposition"
permalink: /case-studies/sap-commerce-microservices-migration
category: case-study
tags: [java, sap-commerce, microservices, spring-boot]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "SAP Commerce → Microservices"
snippet: "Migrating three SAP Commerce platforms from monolith to a Spring Boot microservices ecosystem in parallel - with shared platform capabilities so each team isn't reinventing the same primitives."
snippet_id: "Memigrasi tiga platform SAP Commerce dari monolit ke ekosistem microservices Spring Boot secara paralel - dengan kapabilitas platform bersama agar setiap tim tidak membangun ulang primitif yang sama."
published: false
---

> **Disclaimer:** This is internal company work, still in progress. I've kept the public-facing platform names (seva.id, auto2000, motorkux.id) since they are publicly known, but the architecture is described at the design level without exposing internal service boundaries or technical details that would identify specific team responsibilities.

> **Status:** Ongoing. This case study captures the migration's shape and my thinking as of mid-2026. I'll come back and fill in the specifics as milestones land.

## The Background

The [SAP Commerce 6.6 → 2205 upgrade](/case-studies/sap-commerce-2205-upgrade) gave the three platforms - seva.id, auto2000, motorkux.id - a supported runtime. What it didn't give them was independence from each other.

They share a monolith. One codebase, three brands, one release pipeline. Every cross-domain change pays a coordination tax. Every platform team waits on the same deploy cadence. Every shared extension is a place where one team's "improvement" can quietly break another team's path. The upgrade restored support; it didn't fix the shape.

So the next initiative, the one I'm running now, is the modernization to a Spring Boot–based microservices ecosystem. Each brand gets its own footprint. The shared concerns get pulled out into shared platform capabilities. And the things that used to require a release window become things a team can deploy on their own schedule.

## Why Modernize

> **TODO:** Pick the strongest single business framing. The right one to lead with depends on what was driving the original conversation - candidates:
> - The platforms were waiting on each other to ship features that should have been independent.
> - Specific extensions had become unmaintainable, and refactoring them inside the monolith wasn't tractable.
> - Vendor cost / licensing pressure that microservices ease.
> - Performance ceiling under the monolith model that horizontal microservices solve.
> - Hiring - the monolith's tech stack is hard to recruit for; Spring Boot isn't.

The honest answer is usually some weighted mix of these. Pick the one that's truest in the conversations that actually got the budget approved, and lead with that.

## The Target

The picture I'm building toward looks roughly like this:

```
                    [ Storefront / BFF ]
                            │
                            ▼
+------------------+    +------------------+    +------------------+
| Domain Service A | ←→ | Domain Service B | ←→ | Domain Service C |
+------------------+    +------------------+    +------------------+
        │                       │                       │
        └───────────────┬───────┴───────────────────────┘
                        ▼
                 [ Kafka backbone ]
                        │
                        ▼
              [ Shared platform services ]
              - Decision-as-a-Service ✓
              - (more to come)
```

Per-brand domain services on top, a Kafka backbone for asynchronous cross-domain events, a thin layer at the bottom of shared platform capabilities that every brand consumes rather than rebuilds.

> **TODO:** Replace the ASCII diagram with a proper SVG once the architecture is more settled. The text version is fine for a draft, but a clean diagram is much more readable.

> **TODO:** List the actual domains being carved out. Probably some shape of: catalog, cart, order, promotion, search, content, identity, integration. Pick the ones that are real and concrete in the current plan rather than guessing.

### Shared platform capabilities

This is the part that compounds. Every domain team gets to consume primitives instead of rebuilding them.

- **[Decision-as-a-Service](/case-studies/decision-as-a-service)** is the first one shipped. Business rules go through a custom DSL and a two-service decisioning platform; the domain teams don't write Drools integrations any more. Going live with this modernization.
- > **TODO:** List the other shared services in scope - candidates: identity / Permission-Based Access Control (PBAC), notification, audit, feature flagging, image proxy, observability standards layer. Each one is its own case study eventually.

## How I'm Getting There

The big question on a migration like this is which pattern dominates. There are roughly four to pick from:

- **Strangler fig** - put a routing layer in front of the monolith, peel off endpoints one at a time, route to the new service as soon as it ships.
- **Parallel run** - build the new service alongside the old code path, dual-write to both, compare outputs, switch reads when you trust the new one.
- **Domain-by-domain big-bang** - extract a whole domain, switch in one go, move on.
- **Hybrid** - some shape of the above, depending on the domain.

Real-world migrations almost always end up hybrid, but the dominant pattern dictates which tooling you invest in first.

> **TODO:** Name the pattern you picked, why, and the one piece of tooling that mattered most. (My guess from how this kind of work usually goes: strangler fig for read-heavy paths, parallel run for write paths where correctness has to be verified, domain-by-domain for things small enough to extract cleanly. But confirm before publishing.)

### Rollout sequencing

> **TODO:** Which domain or which platform went first, and why. The usual answer is "highest-impact, lowest-risk" - pick the one where the team is strongest, the data is cleanest, and the upside is most visible. Spell it out.

### Data ownership

The thing nobody tells you about microservice migrations is that the data is harder than the services. Every domain has to take ownership of its data, which means splitting things out of the shared schema, which means dual-writes during the transition, which means correctness checks.

> **TODO:** Describe the approach. Common shapes: schema-per-service with a transition window of dual-writes; logical separation first (one schema, one DB, but disciplined ownership), physical split later; outbox pattern for cross-service consistency on writes.

### Living with the old endpoints

The existing storefronts make calls into the monolith. Those calls have to keep working through the entire transition. There are a few standard answers:

- An adapter layer in the monolith that forwards to the new service.
- An API gateway that routes selectively.
- Maintaining the old endpoints in the new service for parity.

> **TODO:** Pick the one being used and explain why. This is usually the single biggest source of "weird coupling" debt that lasts longer than expected, so being explicit about the strategy matters.

## Where I Am Right Now

- **Three parallel rewrite tracks**, one per brand. The shared platform layer is what keeps them from drifting.
- Engineering standards for distributed systems defined and in active use across all three tracks.
- [Decision-as-a-Service](/case-studies/decision-as-a-service) is built and goes live with this modernization.
- The 2205 upgrade is done. The monolith is on a supported runtime, which is the only reason any of this is tractable.

> **TODO:** Add the concrete progress markers - number of services in prod, number of endpoints migrated off the monolith, percentage of read traffic served by the new services, etc. Even rough numbers are worth more than vague phrases.

## Engineering Standards

If the migration's only output were three microservices ecosystems, each one drifting in its own direction, I'd have lost the plot. The engineering standards are what keeps that from happening.

> **TODO:** List the non-negotiables. The ones I expect to matter:
> - Auth: OAuth2 client_credentials, permission-based `@Secured` annotations, no broad roles.
> - Observability: correlation IDs through every request, structured logs, standard metrics, distributed tracing.
> - Error contract: typed error envelope, same across every service.
> - Deployment: containerized on AKS, Kubernetes-native health probes, HPA policies.
> - API design: REST conventions, idempotency keys for writes, explicit versioning.
> - Event contracts: Kafka topic naming convention, schema versioning, retry and DLQ policy.

The ones the platform layer already enforces (Decision-as-a-Service uses these) are the same ones the domain teams adopt for their own services. That alignment is half the value of having a platform layer at all.

## Lessons So Far

> **TODO:** Honest reflection. This is the section that distinguishes a Lead-level case study from a Senior-level one - fill it in with specifics, not platitudes. Candidates worth thinking about:
> - What turned out to be harder than the planning suggested.
> - Where the shared platform pattern is paying off, and where it's still too thin to lean on.
> - Coordination across three teams - what works, what doesn't.
> - The gap between architectural intent and how things actually land in production.

## What's Next

> **TODO:** The next two or three milestones, with rough timelines if defensible. Whatever's coming up in the next quarter that you'd be happy to talk about in an interview.

## Final Thoughts

The thing I find myself coming back to on a migration this size is that the architecture is almost never the hardest part. The patterns are well-understood. The hard parts are organisational - three teams aligning on standards, data ownership being negotiated, the old monolith being kept alive long enough for the new world to be ready to receive its traffic.

I'll write this case study properly once I'm further through it. For now it's a sketch, and a placeholder for the work that's actually being done.
