---
layout: article
title: "Spring Data JPA: How I Diagnose and Fix the N+1 Query Trap"
description: "A practical guide to spotting and fixing the N+1 query problem in Spring Data JPA, comparing fetch joins, EntityGraph, DTO projections, and batch fetching."
date: 2026-04-28
date_modified: 2026-04-28
keywords: "Spring Data JPA, Hibernate, N+1 Query, EntityGraph, JOIN FETCH, DTO Projection, Batch Fetch, Spring Boot"
tags: [java, spring-boot, spring-data-jpa, hibernate, performance]
permalink: /articles/spring-data-jpa-n-plus-one
breadcrumb: "Articles"
breadcrumb_short: "JPA N+1"
snippet: "A practical guide to diagnosing and fixing the N+1 query trap in Spring Data JPA, comparing JOIN FETCH, @EntityGraph, DTO projections, and batch fetching - and how to pick the right one for the access pattern."
snippet_id: "Panduan praktis untuk mendiagnosa dan memperbaiki jebakan N+1 query di Spring Data JPA, membandingkan JOIN FETCH, @EntityGraph, DTO projection, dan batch fetching - serta cara memilih yang paling cocok untuk pola akses datanya."
canonical_url: ""
canonical_source: ""
published: false
---

## The Background

The N+1 query problem is the single most common performance issue I see in Spring Data JPA codebases. The setup is always the same. Someone writes a clean repository method, the unit tests pass, the local dev environment feels snappy, and then production starts firing 400 SQL statements per HTTP request because the test fixture had three rows and production has three thousand.

The frustrating part is that JPA itself isn't doing anything wrong. Lazy loading is the correct default — eager-loading every association would be far worse. The problem is that lazy loading is invisible from the calling code. A repository method that looks like one query is actually one query plus N more, fired one at a time as the caller iterates over the result.

This article walks through how I reproduce the problem deliberately, the four fixes I reach for most often, and the trade-offs that make me pick one over the others. Everything below assumes Spring Boot 3.x with Hibernate 6.x.

## Reproducing It

Here's a minimal entity pair I'll use throughout the article. An `Order` has many `OrderLine`s, and the relationship is lazy by default for `@OneToMany`:

```java
@Entity
class Order {

    @Id
    private Long id;

    private String customerEmail;

    @OneToMany(mappedBy = "order", fetch = FetchType.LAZY)
    private List<OrderLine> lines;

    // getters / setters
}

@Entity
class OrderLine {

    @Id
    private Long id;

    @ManyToOne
    private Order order;

    private String sku;
    private int quantity;
}
```

A repository method that just fetches all orders:

```java
interface OrderRepository extends JpaRepository<Order, Long> {
}
```

And a service that prints each order with its line count:

```java
@Service
class OrderReportService {

    private final OrderRepository orders;

    @Transactional
    public void printSummary() {
        for (Order o : orders.findAll()) {
            System.out.println(o.getId() + " has " + o.getLines().size() + " lines");
        }
    }
}
```

Turn on SQL logging in `application.properties`:

```properties
spring.jpa.show-sql=true
spring.jpa.properties.hibernate.format_sql=true
logging.level.org.hibernate.orm.jdbc.bind=TRACE
```

Run with three orders in the database. The console shows:

```
select o1_0.id, o1_0.customer_email from orders o1_0
select l1_0.order_id, l1_0.id, l1_0.sku, l1_0.quantity from order_line l1_0 where l1_0.order_id=?
select l1_0.order_id, l1_0.id, l1_0.sku, l1_0.quantity from order_line l1_0 where l1_0.order_id=?
select l1_0.order_id, l1_0.id, l1_0.sku, l1_0.quantity from order_line l1_0 where l1_0.order_id=?
```

That's the N+1. One query for the parent, plus N more — one per parent, fired as the loop touches `o.getLines()`.

## The Common Fixes

### JPQL fetch joins

The most direct fix is to tell JPA to fetch the lines in the same query, using `JOIN FETCH`:

```java
interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("select distinct o from Order o left join fetch o.lines")
    List<Order> findAllWithLines();
}
```

The `distinct` is there because the join multiplies parent rows by child rows, and without it you'd see `Order` instances repeated. The result is a single SQL query that returns the cartesian product, and Hibernate de-duplicates the parent side in memory.

This is fast and obvious. The catch is pagination. If you try to combine `JOIN FETCH` with `Pageable`, Hibernate emits the warning:

```
HHH000104: firstResult/maxResults specified with collection fetch; applying in memory
```

What that actually means: Hibernate fetches the entire result set from the database, then slices it in Java. For 50,000 orders that's a disaster. So `JOIN FETCH` is fine for bounded result sets, dangerous for paginated ones.

### `@EntityGraph`

`@EntityGraph` is my default. It expresses "load these associations eagerly for this query" without coupling the fetch plan to the query string. Ad-hoc form on a repository method:

```java
interface OrderRepository extends JpaRepository<Order, Long> {

    @EntityGraph(attributePaths = {"lines"})
    @Override
    List<Order> findAll();

    @EntityGraph(attributePaths = {"lines"})
    Page<Order> findByCustomerEmail(String email, Pageable page);
}
```

The named form lives on the entity:

```java
@Entity
@NamedEntityGraph(
    name = "Order.withLines",
    attributeNodes = @NamedAttributeNode("lines")
)
class Order { /* ... */ }
```

```java
@EntityGraph(value = "Order.withLines")
List<Order> findByStatus(String status);
```

Same effect as `JOIN FETCH` — Hibernate emits a single query with the join — and it interacts a little better with method composition, derived queries, and Specifications. The same pagination caveat applies, though, because the underlying SQL is the same join.

### DTO projections

If you don't actually need the full entity graph, the cheapest fix is not to load it. Project straight into a DTO with the columns you need:

```java
public record OrderSummary(Long id, String customerEmail, long lineCount) {}

interface OrderRepository extends JpaRepository<Order, Long> {

    @Query("""
        select new com.example.OrderSummary(o.id, o.customerEmail, count(l))
        from Order o left join o.lines l
        group by o.id, o.customerEmail
        """)
    List<OrderSummary> findSummaries();
}
```

One query, no entity hydration, no lazy associations to trip over later. This is the answer for read endpoints and report screens where the caller doesn't need to mutate the data.

Spring Data also supports interface-based projections (`interface OrderSummary { Long getId(); String getCustomerEmail(); }`), which work for derived queries without a custom JPQL — useful when the projection is a strict subset of entity columns and no aggregation is needed.

### Batch fetching

The fourth option is to keep the lazy associations and tell Hibernate to fetch them in batches instead of one at a time. Globally, in `application.properties`:

```properties
spring.jpa.properties.hibernate.default_batch_fetch_size=50
```

Or per-association, on the entity:

```java
@OneToMany(mappedBy = "order")
@org.hibernate.annotations.BatchSize(size = 50)
private List<OrderLine> lines;
```

Re-running the report service with batch fetching enabled, the SQL becomes:

```
select o1_0.id, o1_0.customer_email from orders o1_0
select l1_0.order_id, l1_0.id, l1_0.sku, l1_0.quantity
  from order_line l1_0 where l1_0.order_id in (?, ?, ?)
```

One parent query, plus one child query per batch of 50. For 1,000 orders that's 21 queries instead of 1,001. Not as good as a single fetch join, but it composes with anything — pagination, lazy initialization in the view layer, you name it. I think of it as the safety-net default for entity reads where I haven't decided yet whether a particular call site needs eager loading.

## Comparing the Approaches

| Approach | Best for | Watch out for |
|---|---|---|
| `JOIN FETCH` | Bounded result sets, single screen, single transaction | Pagination warning HHH000104 |
| `@EntityGraph` | Same as `JOIN FETCH` but you want declarative fetch plans | Same pagination caveat |
| DTO projection | Read-only views, reports, list screens | No entity behaviour available downstream |
| Batch fetching | Anywhere lazy loading is OK but N+1 is the worst case | Doesn't reduce queries to one — just to N/batch |

When I'm starting a project I turn on `default_batch_fetch_size=50` immediately. It catches everything I miss and degrades gracefully when I do remember to add an `@EntityGraph`. The other three I add per-call-site as profiling tells me to.

## Pitfalls

### `MultipleBagFetchException` when you fetch two collections

The moment you try to fetch two `List` associations at once:

```java
@Query("select o from Order o left join fetch o.lines left join fetch o.discounts")
List<Order> findAllWithLinesAndDiscounts();
```

Hibernate refuses with `MultipleBagFetchException: cannot simultaneously fetch multiple bags`. The reason is that a SQL join over two collections creates a cartesian product the framework can't safely de-duplicate.

Two ways out: change one of the fields to `Set` instead of `List` (Hibernate handles `Set` differently), or split into two queries — fetch the parent + first collection, then fetch the second collection in a follow-up query. I usually pick the second option because changing collection types has downstream impact on equals/hashCode and serialization.

### `HHH000104: firstResult/maxResults specified with collection fetch; applying in memory`

This is the warning I called out earlier. Hibernate is telling you that the page slicing happened in Java, after pulling the full result set. If you see it in production logs, your "paginated" query is actually loading everything and the page size is decorative.

The fix is to do a two-step fetch: first query just the IDs of the page, then a second query with `where id in (:ids)` plus the `JOIN FETCH`. Spring Data doesn't do this automatically.

### Reusing a query with a stale fetch graph

If you build a `TypedQuery` and apply an `EntityGraph` hint to it, then re-use the same query later without the hint, the hint sticks around. This is rare in pure repository code but bites people who build queries via `EntityManager` directly. When in doubt, build a fresh query each time.

## Conclusion

N+1 isn't really a Spring problem — it's a JPA problem that Spring Data exposes more visibly because the repository abstraction makes it so easy to load entities by accident. The fix isn't a single technique; it's picking the right tool for the access pattern.

The mental model I work with is:

- Read-only list view → DTO projection.
- Detail view that needs the full entity → `@EntityGraph`.
- Anything paginated with associations → page IDs first, then fetch the entities by ID with `JOIN FETCH`.
- Default safety net for everything else → `default_batch_fetch_size`.

That covers most of what I run into, and it keeps the code honest about what's actually being loaded.

I hope this helps. Let me know in the comments if you have any questions or if there's a specific JPA pattern you'd like me to cover in more detail.
