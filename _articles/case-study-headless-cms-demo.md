---
layout: article
title: "Building a Headless CMS Demo: Runtime Page Composition and Cache Invalidations"
description: "A technical walkthrough of a headless CMS demo application showcasing runtime page composition, polymorphic component modeling, and aggressive read caching."
keywords: "Headless CMS, runtime page composition, Next.js, Spring Boot, polymorphic JPA, cache eviction, CQRS"
date: 2026-06-17
date_modified: 2026-06-17
permalink: /case-studies/headless-cms-demo-runtime-composition
category: case-study
tags: [architecture, spring-boot, nextjs, cms, redis]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "Headless CMS Demo Architecture"
snippet: "Exploring the architecture of a custom headless CMS demo built with Spring Boot and Next.js, featuring schema-driven forms and runtime page composition."
snippet_id: "Menjelajahi arsitektur demo headless CMS kustom yang dibangun dengan Spring Boot dan Next.js, menampilkan form berbasis skema dan komposisi halaman saat runtime."
image: /images/articles/case-study-headless-cms-demo/cover.png
published: false
---

## The Premise

Enterprise CMS platforms are often massive, doing everything from complex workflow approvals to multi-region content synchronization. But at their core, what most developers want is a way for editors to compose pages using a flexible component system, while keeping the frontend entirely decoupled.

I recently built a [Headless CMS Demo Application](https://github.com/adiputera/demo-cms-storefront) from scratch using Spring Boot 4 and Next.js. The goal wasn't to build a production-ready product, but rather to prototype a specific, clean architectural pattern: **runtime-driven page composition**. 

Instead of hardcoding layouts in the frontend, the CMS dictates what components appear in which "slots." The frontend simply fetches the schema, maps the component types to a registry, and renders them dynamically. This means content editors can add a carousel, banner, or text block to a page, and the storefront adapts instantly—no code changes, no frontend redeploys.

Here is a look at the technical decisions that made this work cleanly.

## The Architecture: Read/Write Separation and Targeted Eviction

One of the biggest pain points in coupled architectures is that administrative actions compete for the same resources as public storefront traffic. To avoid this, I split the backend services:

*   **Storefront Backend (Port 8080):** A highly optimized, read-only API layer. It talks to the database but aggressively caches everything in Redis. It uses `@Transactional(readOnly=true)` and `JOIN FETCH` queries to prevent N+1 issues when eager-loading components.
*   **CMS Backend (Port 8081):** A write-heavy administrative API. This is where content mutations happen (Create/Update/Delete).

This CQRS-lite approach keeps things incredibly simple. When a content editor updates a page via the CMS Backend, the service simply runs a targeted `@CacheEvict` command against Redis. 

For complex entities like products, we need to invalidate both the specific item cache and the list cache. Spring's `@Caching` handles this cleanly:

```java
// CMS Backend (Write API)
@Caching(evict = {
    @CacheEvict(value = "products", key = "'all'"),
    @CacheEvict(value = "products", key = "#result.code")
})
public ProductDTO createProduct(CreateProductRequest request) {
    // Insert logic...
}
```

The next time a customer hits the Storefront Backend, it registers a cache miss, fetches the fresh data from PostgreSQL, and caches it again (usually with a 15-to-30-minute TTL). Immediate consistency for the editor, blazing fast reads for the user.

## Core Design 1: Polymorphic Component Modeling in JPA

A flexible CMS needs to support various component types (e.g., `BANNER`, `PARAGRAPH`, `PRODUCT_CAROUSEL`). Storing these cleanly in a relational database can be tricky. You generally have three options: a massive table with nullable columns, a JSON blob column, or table inheritance.

I opted for JPA's `JOINED` inheritance strategy. This gives us a clean base `components` table containing shared fields (`id`, `uid`, `sort_order`, `type`, `slot_id`), and separate subclass tables for specific fields (e.g., `banner_components` has `image_url` and `cta_url`).

```java
@Entity
@Table(name = "components")
@Inheritance(strategy = InheritanceType.JOINED)
@DiscriminatorColumn(name = "type")
public abstract class Component {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    
    private String uid;
    private Integer sortOrder;
    
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "slot_id")
    private Slot slot;
    
    public abstract ComponentType getType();
}
```

```java
@Entity
@Table(name = "banner_components")
@DiscriminatorValue("BANNER")
public class BannerComponent extends Component {
    private String imageUrl;
    private String title;
    private String ctaUrl;
    
    @Override
    public ComponentType getType() { return ComponentType.BANNER; }
}
```

This ensures referential integrity and strict typing at the database level, unlike dumping everything into a JSONB column. 

When returning data through the APIs, we use Jackson's `@JsonTypeInfo` and `@JsonSubTypes` to automatically serialize and deserialize the correct subclasses based on the `type` field. This means the frontend receives strongly typed JSON payloads without the backend needing massive `switch` statements during serialization.

## Core Design 2: Schema-Driven Admin Forms

A common friction point in headless CMS development is that every time you invent a new component type (say, a `VideoPlayer`), you have to write a custom React form in the admin panel to let editors configure it.

To bypass this, the CMS frontend relies on **Dynamic Schema-Driven Form Generation**. The admin UI makes a call to the backend (`/api/cms/components/types/{type}/schema`), which returns the exact fields required for that component. 

The frontend then loops through this schema, dynamically rendering text inputs, rich textareas, or image uploaders based on the metadata. The frontend code is completely agnostic to the specific component types. If I add a `VideoPlayer` entity to the backend tomorrow, the admin UI automatically knows how to render a configuration form for it. This eliminates the need to update the admin frontend when adding backend features.

## Core Design 3: The Product Detail Template Pattern

Hardcoding product detail pages (PDPs) is a common mistake. If marketing wants to add a promotional banner to the MacBook Pro page, developers usually have to deploy a code change.

In this architecture, Product Detail Pages (`/products/[code]`) are mapped to a CMS page layout. We use a generic `/products/detail` page slug in the CMS as the template. This allows editors to drag and drop standard components (banners, text blocks, carousels) around the main `PRODUCT_DETAIL` component.

At runtime, the storefront fetches the product data for `macbook-pro` and binds that data context to the child `PRODUCT_DETAIL` component. If marketing wants to add a Black Friday banner above all products, they simply add a `BANNER` component to the top slot of the `/products/detail` page in the CMS. Every product page updates instantly.

## Core Design 4: Runtime Page Composition in Next.js

The magic happens on the public storefront. The Next.js app knows absolutely nothing about the layout of a page. 

When a user visits `/about-us`, the Next.js app hits the Storefront API. To avoid N+1 network requests, it does this in two steps:
1. Fetch the page metadata and available slots (`GET /api/pages/about-us`).
2. Batch fetch all components for those slots (`POST /api/slots/details`).

By leveraging Next.js React Server Components (RSC), these fetches happen entirely on the server, avoiding client-side waterfalls. 

In Next.js, we maintain a strict `ComponentRegistry`. When iterating over the components payload, the frontend dynamically loads the corresponding React component based on the `type` string.

```tsx
// ComponentRegistry.tsx
import dynamic from 'next/dynamic';

const componentRegistry = {
  BANNER: dynamic(() => import('./components/BannerComponent')),
  PARAGRAPH: dynamic(() => import('./components/ParagraphComponent')),
  PRODUCT_CAROUSEL: dynamic(() => import('./components/ProductCarouselComponent')),
  PRODUCT_DETAIL: dynamic(() => import('./components/ProductDetailComponent')),
};

export default function ComponentRenderer({ component }) {
  const ComponentClass = componentRegistry[component.type];
  
  if (!ComponentClass) {
    return <div className="error print-no-link">Unknown component: {component.type}</div>;
  }
  
  return <ComponentClass data={component} />;
}
```

This is true decoupled architecture. The editor drops a `PRODUCT_CAROUSEL` into the "Hero" slot of the homepage via the admin UI. The backend updates. The cache is evicted. The very next visitor gets the new JSON payload, and Next.js renders the carousel—all without a single line of frontend code changing or deploying.

## The Takeaway

Building a full-scale CMS is an immense undertaking, but prototyping the core mechanics reveals a lot about architectural trade-offs. 

By aggressively decoupling the read/write paths, leaning into JPA's polymorphic mapping for strict database typing, implementing template-driven pages, and relying on runtime dynamic rendering on the frontend, you get an incredibly resilient and flexible system. The frontend becomes a dumb presentation layer, the database enforces strict schemas, and the CMS administration panel dictates the experience dynamically.
