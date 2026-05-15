---
layout: article
title: "SAP Commerce 6.6 → 2205: A Zero-Downtime On-Premise Upgrade Across Three Platforms"
description: "How I upgraded three live SAP Commerce platforms from 6.6 to 2205 on-premise, including a Solr 8.11 → 9.10 major-version jump, without a single second of production downtime."
date: 2026-05-13
date_modified: 2026-05-13
keywords: "SAP Commerce upgrade, SAP Hybris upgrade, 6.6 to 2205, Apache Solr 9, zero downtime migration, on-premise SAP Commerce"
permalink: /case-studies/sap-commerce-2205-upgrade
category: case-study
tags: [sap-commerce, upgrade]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "SAP Commerce 2205 Upgrade"
snippet: "Upgrading three live SAP Commerce platforms from 6.6 to 2205 on-premise, including a Solr 8.11 → 9.10 jump, without a single second of production downtime."
snippet_id: "Mengupgrade tiga platform SAP Commerce yang berjalan dari 6.6 ke 2205 secara on-premise, termasuk lompatan Solr 8.11 → 9.10, tanpa downtime produksi sedetik pun."
published: false
---

> **Disclaimer:** This case study covers internal SAP Commerce upgrade work I led across three live platforms. The narrative is sanitized for public sharing - I've kept the public-facing platform names (seva.id, auto2000, motorkux.id) since they are publicly known, but anything below the surface is described at the architecture level.

## The Background

Three live SAP Commerce platforms - seva.id, auto2000, motorkux.id - were all running SAP Commerce 6.6, a release that was years past mainstream support by the time we started the upgrade work. The vendor was no longer shipping security patches against it, and every new business requirement was bumping into APIs that had been deprecated three major versions ago. We were running on borrowed time.

The target was 2205, on-premise. Not CCv2 - the deployment topology stays the same, the platform version is what moves.

The constraint on top of that was the one that made this hard. None of the three platforms could afford a maintenance window. The platforms underpin live commerce flows, weekend launches, and auto-industry events; "we'll be back at 3am" was not on the table. So the brief was: multi-major version jump, three platforms, on-premise, zero downtime.

## What Moved

| Component | From | To |
|-----------|------|-----|
| SAP Commerce | 6.6 | 2205 |
| Apache Solr | 8.11 | 9.10 |
| Deployment | On-premise | On-premise (unchanged) |
| Platforms | seva.id, auto2000, motorkux.id | same three |

> **TODO:** Fill in the Java version path (probably Java 8 → Java 17, but confirm), and the number of custom extensions that were touched. These are defensible numbers worth quoting in interviews.

## The Hard Parts

### Multi-major version jump

6.6 to 2205 is not a hop, it's a leap. In between sit several deprecation cycles, removed extensions, replaced subsystems, and changed defaults. A lot of the 6.6 codebase relied on assumptions that quietly stopped being true somewhere between then and now.

The first pass was an inventory: every custom extension, every overridden OOTB bean, every JSP tag, every direct call into APIs that the changelogs flagged. That inventory is what told us how big the migration actually was, not the changelogs themselves.

> **TODO:** Call out the few categories of breaking changes that ate the most time. Likely candidates: specific deprecated extensions, Backoffice changes, JSP tag library changes, OOTB bean overrides that broke under the new BeanFactory rules. Pick the two or three that felt most painful.

### Solr 8.11 → 9.10

Solr 9 is a major release with backwards-incompatible changes. The configset format changed, parts of the schema API surface evolved, and on a catalog of real size, you can't just take the index offline and rebuild.

The trick on a live system is keeping queries serving against the old index while the new one is being built.

> **TODO:** Describe the actual approach you used. Parallel collection with an alias swap? Hot reindex with dual-write? A read-side fallback to the old collection if the new one wasn't ready? Whichever it was, name it - that's the part interviewers will probe.

### Zero downtime on on-prem

CCv2 ships blue-green out of the box. On-prem doesn't - you build it yourself.

> **TODO:** Walk through the cutover technique. Likely shape: parallel cluster brought up on 2205, traffic flipped at the load balancer, old cluster kept warm as a rollback target. Add the bits that matter: how DB schema migrations were handled forward-compatibly so both versions could read the same tables during the cutover window; how session state and cart state survived; how the cache layer (EHCache, CDN) was warmed on the new side before the flip.

## What It Cost

Honestly, the biggest cost was preparation, not execution. The actual cutover was a series of carefully-orchestrated steps; the months before were a slow grind of:

- reading changelogs;
- patching the inventory list as things turned up that the changelogs missed;
- staging dry-runs against production-shaped data;
- finding the test data drift that meant our staging environment didn't catch the bug production was about to.

Every one of those was less glamorous than the cutover itself, and every one of them was what made the cutover boring.

## Results

- **Zero production downtime** across all three platform cutovers. No dropped requests, no maintenance window visible to end users.
- All three platforms now running on a supported SAP Commerce release. The previous "we can't upgrade that library because the platform won't run on it" conversations stopped.
- Solr 9 unblocked the query and security improvements I'd been wanting, and put us back inside the vendor's support window.
- Most importantly, the upgrade is what unblocked the [SAP Commerce → Microservices modernization](/case-studies/sap-commerce-microservices-migration) work that came next. You can't strangler-fig a monolith you can't reliably deploy.

> **TODO:** Add quantitative measurements once they're defensible - post-upgrade search latency change, index build time change, post-upgrade incident count over the first month, anything that gives a reader a number to hold onto.

## What I'd Do Differently

> **TODO:** Honest retrospective. Candidates worth thinking about:
> - The pre-flight extension audit - was it thorough enough, or were there things I only found in staging dry-runs?
> - Solr 9 migration tooling - what would I have wanted that didn't exist?
> - The coordination model across the three platforms - did we go sequential, parallel, or something in between, and was that the right call?
> - Test data freshness - the gap between staging and production was real; what would have closed it?

## Final Thoughts

The interesting engineering on an upgrade like this is almost never on the cutover day itself. By the time you're flipping load balancers, the work is already done - everything you didn't catch in the staging dry-runs is what bites you, and the staging dry-runs are months of patient inventory work. The boring part is the work. The exciting part is what doesn't go wrong.
