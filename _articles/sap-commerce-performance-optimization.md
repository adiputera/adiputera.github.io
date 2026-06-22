---
layout: article
title: "SAP Commerce (Hybris) Performance Optimization Strategies"
description: "Practical approaches for improving API and page load performance in SAP Commerce (Hybris) using Solr indexing, lazy loading, multi-threading, and OCC caching."
keywords: "SAP Commerce, Hybris, SAP Hybris, Performance Optimization, Caching, Solr, Multi-threading, OCC API, Java"
date: 2025-10-17
date_modified: 2026-05-12
tags: [sap-commerce, performance, caching]
canonical_url: ""
canonical_source: ""
breadcrumb: "Articles"
breadcrumb_short: "SAP Commerce Performance"
permalink: /articles/sap-commerce-performance-optimization
snippet: "A look into practical techniques for boosting SAP Commerce performance, from Solr-backed PDPs to OCC API caching."
image: /images/articles/sap-commerce-performance-optimization/cover.webp
og_image_width: 1024
og_image_height: 1024
og_image_type: image/webp
snippet_id: "Tinjauan tentang teknik praktis untuk meningkatkan performa SAP Commerce, mulai dari PDP berbasis Solr hingga caching OCC API."
published: true
---

Improving performance in SAP Commerce (Hybris), especially in the non-cloud version running the Accelerator storefront, can be a bit tricky.

Yes, there is component cache, query cache, and entity cache, but sometimes that is just not enough. In our project, the price differs from city to city, and it is determined by the user's location. Search restrictions work, but we still needed more performance.

Here are some approaches we explored to push the system further.

## Indexing Product Details to Solr

We implemented a bit of a drastic approach: indexing many parts of the product details into Solr. 

So the Product Details Page (PDP) in our project is served primarily from Solr. We applied the same approach to the product carousel, so it could load faster, and it works.

## Component Lazy Load

Next, we implemented component lazy load. 

On page load, only the top of the page components and SEO-important components are loaded. The rest will be loaded when the user scrolls through the page. You can read my detailed guide on [how to implement lazy loading of CMS components in SAP Commerce](/articles/component-lazy-load-sap-commerce).

## Multi-Threading for Model Fetching

But still, I think there is a long way to go before we reach optimal performance. Lately, I've been thinking of using multi-threading to fetch multiple models in one go.

If the query and converter for one model takes 300ms, and there are 5 models to fetch, fetching in sequence would take 1500ms. Fetching them in parallel would only take 300ms plus some small overhead time. Much faster! 

This has to be handled with care since using too many threads can potentially backfire.

## OCC API Caching

Another idea that comes to my mind is instead of a traditional controller -> facade -> service -> DAO flow, I could use the OCC API that is cacheable.

The flow would be: controller -> API call to OCC. If cached, serve from cache. Else, proceed with facade -> service -> DAO. 

Surely this will also improve performance. Yes, the first hit served from non-cache would take a longer time, but that is a tradeoff for better performance overall.

## Final Thoughts

At the end of the day, no matter how good the performance of your application is, there will always be room for another improvement. Maybe the solution is yet to be found, but it is there waiting to be found.
