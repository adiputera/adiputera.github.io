---
layout: article
title: "Full Page Cache on EhCache: Cutting Catalog Page Latency Without a CDN Rewrite"
description: "How I built a JVM-local full page cache on EhCache to serve catalog and CMS pages from memory, including the invalidation, personalization, and multi-node consistency problems that come with it."
date: 2026-01-01
date_modified: 2026-01-01
keywords: "EhCache, full page cache, SAP Commerce, JVM cache, Java caching, page caching, cache invalidation, multi-node cache"
permalink: /case-studies/full-page-cache-ehcache
category: case-study
tags: [java, caching, performance, sap-commerce]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "Full Page Cache (EhCache)"
snippet: "Building a JVM-local full page cache on EhCache to serve catalog and CMS pages from memory, and the invalidation, personalization, and multi-node consistency problems that come with it."
snippet_id: "Membangun full page cache di level JVM dengan EhCache untuk melayani halaman katalog dan CMS dari memori, termasuk masalah invalidasi, personalisasi, dan konsistensi multi-node yang menyertainya."
published: false
---

> **Disclaimer:** This case study covers internal full page caching work I led on live SAP Commerce platforms. The narrative is sanitized for public sharing. The public-facing platform names (seva.id, auto2000, motorkux.id) are kept since they are publicly known, but cache keys, invalidation rules, and the specifics of what got cached are described at the architecture level.

> **TODO:** Confirm the publish date and set both `date` and `date_modified` before flipping `published: true`. Also remember to update `_data/lastmod.yml` and `sitemap.xml`.

## The Background

Catalog and CMS pages on the platforms (seva.id, auto2000, motorkux.id) were doing a lot of work per request. Even with database indexes in place and the usual Hibernate-level caching, every request was assembling a page out of dozens of model lookups, CMS component reads, price calculations, and category traversals. On a cold JVM, p95 latency on the heaviest pages sat well above what the business wanted to see during launches.

A CDN sits in front, but the CDN can only do so much. Logged-in traffic skips the CDN. Promotion changes and CMS edits need to be reflected in seconds, not in the CDN TTL. And the CDN doesn't help with the load on the origin when it misses, which is the moment that matters most: a campaign goes live, the CDN is cold, and every origin server gets the storm.

So the brief was: a second layer of caching, inside the JVM, that could serve full rendered pages in memory and absorb the origin storm whenever the CDN missed.

> **TODO:** Confirm whether this work covered all three platforms or only the ones with the heaviest catalog traffic. The story is stronger if it ran across all three; quieter if it was one platform.

## What Got Cached

| Layer | Mechanism | Scope |
|-------|-----------|-------|
| Edge | CDN | Public, anonymous traffic |
| Origin (this work) | EhCache, in-JVM | Rendered page output, keyed by request signature |
| Below | Hibernate L2, flexible search cache | Already in place, not changed by this work |

The full page cache sits between the CDN and the application's page assembly code. When a request comes in and the cache key matches, the rendered output is returned without touching the page-assembly pipeline at all. When it misses, the request flows through normally and the result is stored on the way out.

> **TODO:** Decide whether to call out the page categories that were cached (PDP, PLP, CMS landing pages, category pages) versus the ones that were intentionally excluded (cart, checkout, account). The exclusion list is what reviewers will probe.

## The Hard Parts

### Cache key design

A URL is not a cache key. The same URL can render differently for a dozen reasons: locale, currency, customer segment, A/B variant, feature flag state, even the device class on some templates. Cache a page under the URL alone and within a week you will be serving the wrong currency to the wrong country, and you will find out from a customer.

The key had to encode every input that could change the output. The trick was finding that list without over-keying it. Over-key, and the cache hit ratio collapses because almost every request gets a unique key. Under-key, and you serve wrong content.

> **TODO:** Walk through the actual cache key composition. Likely shape: URL + locale + currency + a normalized customer segment ID + a CMS catalog version token. Name the inputs that turned out to matter and the ones that almost shipped as keys but turned out to be redundant.

### Invalidation

CMS edits and product changes need to be visible in seconds. EhCache TTL alone gives you eventual consistency at the TTL boundary, which is not what content editors expect when they hit publish.

The fix was an event-driven invalidation: every write that could affect a cached page produced an invalidation event, and the cache listened for those events and dropped the matching entries. The hard part was mapping a write (a CMS component update, a price row change, a category move) to the set of cache keys it could invalidate, without invalidating so broadly that the cache stopped being useful.

> **TODO:** Describe the invalidation event model. Likely shape: domain events emitted from interceptors / save listeners, a small in-process bus, and a mapping table from event type to a key-prefix pattern. Call out the one or two cases where the mapping was hard - probably anything touching the navigation tree or shared CMS slots, because a single edit there can invalidate a huge fraction of the cache.

### Multi-node consistency

EhCache lives in the JVM. With multiple application nodes, each node has its own cache, and an invalidation on node A does nothing for nodes B and C until they get the signal too. On a multi-node SAP Commerce cluster, this is the part where naive setups go wrong: an editor publishes, refreshes their browser, sees the update, refreshes again, sees the old content because the load balancer routed them to a different node.

> **TODO:** Document the replication choice. EhCache historically supported RMI replication and JGroups; modern stacks lean on a messaging hop (e.g. a topic that every node subscribes to). Name what was used, why it was picked over the alternatives, and what the failure mode is when the messaging layer is degraded. The honest answer about the failure mode is what makes this credible.

### Personalization and the "do not cache" list

A full page cache only works if you are disciplined about what does not go in it. Logged-in user pages, cart, checkout, anything personalized down to the individual user: those skip the cache entirely. The rule sounds obvious; the discipline is harder, because the next ticket will always be a request to "just cache this small bit too" and one of those tickets is the one that ships personal data to the wrong user.

The defense was a deny-by-default policy at the routing layer: a page was eligible for the cache only if it was on an allowlist, and the allowlist was reviewed at code-review time the same way a security boundary is.

> **TODO:** Mention the one near-miss (or actual incident) that justified the deny-by-default policy, if there was one. If there was not, say so honestly - the policy was a preventive choice, not a post-incident correction.

### Sizing and eviction

EhCache regions need to be sized. Too small, and the eviction churn kills the hit ratio. Too large, and you eat into the heap that the rest of the platform needs, and GC pauses start to show up in the p99.

> **TODO:** Quote the region sizes and eviction policy you settled on, the heap headroom you kept, and the GC behavior before and after. If you used off-heap (EhCache 3 with BigMemory or a tiered store), say so - that's a meaningful design choice. If you stayed on-heap, explain why the simpler choice was the right one here.

## What It Cost

The expensive part was not building the cache. EhCache is well-trodden. The expensive part was the invalidation map and the deny-list discipline.

The invalidation map took weeks of going through every write path in the relevant modules and asking "which pages could this affect?" A lot of those questions had answers like "in theory, almost any page on the site" - and figuring out the practical answer (the small subset that actually mattered) required reading the templates as carefully as the controllers.

The deny-list discipline took longer than the invalidation map, because it never really finishes. Every new feature is a new decision about whether its pages are cacheable, and the default has to be "no" until someone shows the work.

## Results

- **Origin storm absorbed.** The first campaign after the cache went live was the test: CDN warming up, traffic spiking, and the origin held without the usual scramble.
- **Editor-visible content updates within seconds.** The event-driven invalidation closed the gap between hitting publish and seeing the page change.
- **No personalization leaks.** The deny-by-default routing rule held.

> **TODO:** Add defensible numbers. The credible ones are: average p95 reduction on the cached page categories, peak hit ratio during the first big campaign, origin CPU drop at the same RPS, and the gap between editor publish and on-site visibility. Even ranges ("p95 dropped from X-ish to Y-ish") are better than nothing.

## What I'd Do Differently

> **TODO:** Honest retrospective. Candidates worth thinking about:
> - The invalidation map - was the per-event mapping the right model, or would a generation-counter approach (bump a version, treat old entries as stale) have been simpler at the cost of a lower steady-state hit ratio?
> - Replication choice - if you used RMI/JGroups, would you pick the same again on a greenfield project, or would you go straight to a messaging-bus approach?
> - On-heap vs off-heap - if you stayed on-heap, did GC behavior ever push you to reconsider?
> - The boundary with the CDN - is there work the CDN should have been doing that you ended up doing in the JVM, and would a different cache-control header strategy have moved that load back to the edge?

## Final Thoughts

A full page cache is not really a caching project. It is an invalidation project with a cache attached. Anyone can put EhCache in front of a render method and watch the hit ratio climb on a quiet afternoon. The interesting work is everything that protects you from serving the wrong content the moment something changes, and the discipline that keeps personalized data out of a shared cache no matter how convenient it would be to slip it in.

If you are starting from scratch on a Java enterprise commerce platform, the layered picture in [the multi-layer caching article](/articles/enterprise-commerce-multi-layer-caching) is the bigger frame this fits into. EhCache here is the in-JVM layer. The CDN sits in front of it, and a distributed cache (or a database with its own caches) sits behind it. The point of the layer is that when the CDN misses, you have somewhere fast to land before the origin gets hit.
