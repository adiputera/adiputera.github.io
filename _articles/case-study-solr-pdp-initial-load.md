---
layout: article
title: "Why We Moved PDP Initial Load to Solr in SAP Commerce"
description: "How we optimized PDP initial load performance in SAP Commerce by shifting city-specific pricing, promotions, and credit simulation data into Solr documents to avoid expensive runtime filtering and database joins."
keywords: "SAP Commerce Solr, PDP optimization, Solr indexing strategy, SAP Commerce performance, city based pricing, Solr denormalization, PDP initial load, SAP Commerce architecture"
date: 2026-05-25
date_modified: 2026-05-25
permalink: /case-studies/solr-pdp-initial-load-optimization
category: case-study
tags: [sap-commerce, solr, pdp, performance, search, distributed-systems]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "Solr PDP Optimization"
snippet: "How we redesigned PDP initial load in SAP Commerce by denormalizing city-specific pricing, promotions, and financing data directly into Solr documents to reduce runtime processing overhead."
snippet_id: "Bagaimana kami mendesain ulang initial load PDP di SAP Commerce dengan melakukan denormalisasi pricing, promosi, dan simulasi kredit per kota langsung ke dokumen Solr untuk mengurangi overhead processing saat runtime."
published: false
---

## Designing a Faster PDP Initial Load With Solr in SAP Commerce

One of the biggest performance bottlenecks we faced in our SAP Commerce implementation was the PDP (Product Detail Page) initial load. At first glance, a PDP looks simple: you load the product information, pricing, promotions, financing simulation, and then render the page. But our complexity increased significantly because almost everything was city-dependent. 

Different cities could have different prices, discounts, free gifts, financing simulations, installment values, and available tenors. This made runtime computation extremely expensive. Instead of querying multiple services and filtering everything dynamically during page load, we decided to push most of the read complexity into Solr indexing.

## Why We Used Solr for PDP Initial Load

The main reason was simple: runtime filtering became too heavy. For example, City A and City B could have different product prices, promotions might only exist in certain cities, free gifts might only be available in selected regions, and financing simulations were also city-specific.

If all of these had to be resolved dynamically during PDP rendering, the application would need multiple database queries, promotion engine checks, pricing calculations, filtering logic, and aggregation logic. And this happened for every single PDP request. Under high traffic, this quickly became expensive. 

So instead of calculating everything during runtime, we denormalized the data into Solr documents during indexing. The tradeoff was a more expensive indexing process in exchange for much faster reads. For PDP traffic, this was the correct optimization direction.

## What We Stored in Solr

We didn't just store basic search data. The Solr document evolved into a precomputed read model optimized specifically for PDP rendering.

### Basic Product Information

These are the standard fields you would expect:
- Product code (`code`)
- Product name (`name_text_en`)
- Product images (`image_url`)
- Product specifications (`specs_json`)

### City-Based Pricing

This was one of the most important optimizations. Instead of storing a single price like `price_double_idr`, we stored pricing per city:

```text
price_jakarta_double_idr
price_bandung_double_idr
price_surabaya_double_idr
```

Each city had its own indexed pricing field. We also stored both the before-promotion price and the after-promotion price, because the UI needed to display the active selling price alongside the strikethrough price. 

Example:
```text
price_jakarta_before_double_idr
price_jakarta_after_double_idr
```

This allowed the PDP to render pricing immediately without recalculating promotion effects on the fly.

As an added bonus, this approach naturally tied into how we handled location-based product availability for our PLP (Product Listing Page). If a product is not sold in a particular city, it simply won't have a price indexed for that location. We were actually already using this exact logic to easily filter out unavailable products during search or catalog browsing by adding a simple Solr query parameter like `price_jakarta_double_idr:[* TO *]`. Extending this existing data model to power the PDP was a logical next step.

### Promotion Availability Per City

Some promotions were only active in certain cities, such as free gift availability, regional campaigns, or city-specific promotions. Instead of evaluating promotions dynamically during request time, we stored promotion availability directly in Solr.

Example:
```text
has_freegift_jakarta_boolean
has_freegift_bandung_boolean
```

This made the frontend PDP logic significantly simpler.

### Color Data

We separated two different color concepts to ensure consistency.

**Marketing Color Names:** These are display-oriented values like Titanium Silver, Ocean Blue, or Midnight Black. 
Example: `marketingColorNames_string_mv`

**Plain Colors for Faceting:** For filtering and facet consistency, we also stored normalized colors like White, Blue, or Black.
Example: `colorFacet_string_mv`

This avoided inconsistent facet grouping caused by marketing naming variations.

### Credit Simulation Data

Financing simulation was another expensive runtime operation. Instead of calculating financing dynamically during PDP load, we indexed the minimum display values directly.

**Minimum Down Payment:** `downPayment_jakarta_string`
**Maximum Tenor:** `tenor_jakarta_string`
**Minimum Installment:** `installment_jakarta_string`

The `_string` suffix was intentional here. These values were preformatted for display, especially currency values, not used for numeric sorting or range queries at PDP runtime. Tenor and installment were related, so both needed to stay synchronized in the indexed document. This allowed frontend applications to immediately display financing highlights without waiting for another backend computation.

## Why This Architecture Worked

The key idea was to optimize for read performance. PDP traffic is extremely read-heavy. Users open PDP pages continuously, while indexing happens periodically in the background. So we intentionally shifted complexity from runtime request processing into offline indexing computation.

This gave us:
- Faster PDP response times
- Lower runtime database pressure
- Fewer service calls
- Simpler frontend orchestration
- Better scalability during traffic spikes

Effectively, Solr became more than just a search engine; it acted as a read cache and a precomputed product projection. The PDP read this projection directly from Solr. There was no fallback path that reconstructed the same data from database joins or promotion engine calls during page load. That made the dependency very explicit: if Solr was unavailable, PDP rendering was unavailable too.

## Tradeoffs and Downsides

This architecture was not free, and there were several operational tradeoffs we had to accept.

### Longer Full Indexing Time

The Solr document became much larger because of city-specific fields, promotion metadata, financing projections, and multiple derived values. As the number of cities increased, indexing duration also increased significantly. Full indexing became heavier both in processing time and Solr storage size.

### Potential Stale Data

Because the PDP relied heavily on indexed data, stale data became a risk. For example, price changes, promotion updates, or financing changes could temporarily diverge from source-of-truth systems until reindexing completed.

We reduced that risk with partial indexing. Whenever a promotion was published, we did not run a full index for the entire catalog. We triggered a partial update only for the corresponding affected products, so the Solr projection could be refreshed quickly without paying the cost of a full rebuild.

This is one of the classic tradeoffs of denormalized read models: you get faster reads, but you accept eventual consistency risks. The architecture intentionally accepted small temporary inconsistencies in exchange for substantially better runtime performance.

## Final Thoughts

One important lesson from this implementation was that Solr was no longer just a search engine for us. It evolved into a specialized read model optimized for high-traffic PDP access patterns.

In distributed systems—especially e-commerce systems—runtime flexibility is often expensive. Sometimes the better approach is to precompute aggressively, denormalize intentionally, and optimize for the dominant traffic pattern. 

In our case, the PDP traffic volume completely justified the tradeoff. The indexing pipeline became more complex, but the runtime system became much faster and more scalable.

