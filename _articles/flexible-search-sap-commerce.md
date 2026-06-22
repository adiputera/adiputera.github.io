---
layout: article
title: "FlexibleSearch in SAP Commerce (SAP Hybris): A Practical Guide"
description: "A practical guide to using FlexibleSearch in SAP Commerce (SAP Hybris), covering syntax, common patterns, joins, and tips to avoid pitfalls."
date: 2026-04-27
date_modified: 2026-04-27
keywords: "SAP Commerce, SAP Hybris, FlexibleSearch, Flexible Search, SAP Commerce Query, HAC, Groovy Script"
tags: [sap-commerce, flexiblesearch, querying]
permalink: /articles/flexible-search-sap-commerce
breadcrumb: "Articles"
breadcrumb_short: "FlexibleSearch Guide"
snippet: "A practical guide to FlexibleSearch in SAP Commerce (SAP Hybris), covering the syntax, common query patterns, joins, and a few gotchas that will save you a debugging session."
snippet_id: "Panduan praktis FlexibleSearch di SAP Commerce (SAP Hybris), mencakup sintaks, pola query umum, join, dan beberapa hal yang perlu diwaspadai agar tidak menghabiskan waktu debugging."
image: /images/articles/flexible-search-sap-commerce/cover.webp
og_image_width: 1024
og_image_height: 1024
og_image_type: image/webp
published: false
---

## The Background

If you've worked with SAP Commerce (SAP Hybris) for any length of time, you've run into FlexibleSearch. It's the query language built into the platform for fetching data from the type system. Instead of writing raw SQL directly against the database, you write FlexibleSearch queries, and the platform translates them into SQL for you.

That translation layer is actually the point. SAP Commerce uses its own type system and the underlying database schema is generated, which means table names and column names don't always match what you'd expect. FlexibleSearch abstracts all of that, so your queries stay consistent regardless of whether the platform is running on MySQL, MSSQL, Oracle, or HSQLDB.

This guide covers the basics, common patterns, and some things to watch out for.

## How It Works

FlexibleSearch queries look a lot like SQL, but there are some key differences:

- **Type names go in curly braces**: `{Product}` instead of a table name
- **Attribute names go in curly braces**: `{code}` instead of a column name
- **PK is always available**: every item in SAP Commerce has a `{PK}` attribute

A basic query:

```sql
SELECT {PK} FROM {Product}
```

That returns the PKs of all products. If you want more attributes:

```sql
SELECT {PK}, {code}, {name[en]} FROM {Product}
```

Notice `{name[en]}` -- the `[en]` suffix is how you access localized attributes for a specific language.

## Running FlexibleSearch Queries

There are a few places where you can run FlexibleSearch queries:

**HAC (Hybris Administration Console)**

Go to `https://{your-server}/hac/console/flexiblesearch`. This is the most convenient way to test queries during development. You can see the generated SQL as well, which helps when debugging.

**Groovy Script in HAC**

```groovy
import de.hybris.platform.servicelayer.search.FlexibleSearchQuery
import de.hybris.platform.servicelayer.search.SearchResult

flexibleSearchService = spring.getBean("flexibleSearchService")

String query = "SELECT {PK} FROM {Product}"
SearchResult result = flexibleSearchService.search(new FlexibleSearchQuery(query))
return result.getResult().size()
```

**In Java/Spring code**

```java
import de.hybris.platform.servicelayer.search.FlexibleSearchQuery;
import de.hybris.platform.servicelayer.search.FlexibleSearchService;
import de.hybris.platform.servicelayer.search.SearchResult;

@Autowired
private FlexibleSearchService flexibleSearchService;

public List<ProductModel> getActiveProducts() {
    String query = "SELECT {PK} FROM {Product} WHERE {approvalStatus} = ?approvalStatus";
    FlexibleSearchQuery fsQuery = new FlexibleSearchQuery(query);
    fsQuery.addQueryParameter("approvalStatus", ArticleApprovalStatus.APPROVED);

    SearchResult<ProductModel> result = flexibleSearchService.search(fsQuery);
    return result.getResult();
}
```

Note that `flexibleSearchService.search()` returns model objects, not raw data -- so you get back `ProductModel`, `CategoryModel`, etc., fully populated and ready to use.

## WHERE Clauses and Parameters

You can filter with `WHERE` just like SQL. The important thing here is to **always use query parameters** instead of string concatenation. Concatenating strings directly into your query is asking for trouble.

```java
// Do this
String query = "SELECT {PK} FROM {Product} WHERE {code} = ?code";
FlexibleSearchQuery fsQuery = new FlexibleSearchQuery(query);
fsQuery.addQueryParameter("code", "myProductCode");

// Don't do this
String query = "SELECT {PK} FROM {Product} WHERE {code} = '" + code + "'"; // please don't
```

Using parameters also lets the platform cache and reuse query execution plans, which helps performance.

Some common operators:

```sql
-- Equality
SELECT {PK} FROM {Product} WHERE {code} = ?code

-- LIKE
SELECT {PK} FROM {Product} WHERE {code} LIKE ?codePattern

-- NULL check
SELECT {PK} FROM {Product} WHERE {description} IS NULL

-- IN clause
SELECT {PK} FROM {Product} WHERE {code} IN (?codeList)
```

For the `IN` clause, pass a `Collection` as the parameter value:

```java
List<String> codes = List.of("code1", "code2", "code3");
fsQuery.addQueryParameter("codeList", codes);
```

## JOINs

FlexibleSearch supports JOINs. The syntax is similar to SQL, but you use type names and attribute names in curly braces:

```sql
SELECT {p:PK}
FROM {Product AS p
    JOIN CatalogVersion AS cv ON {p:catalogVersion} = {cv:PK}}
WHERE {cv:version} = ?catalogVersion
    AND {cv:catalog} = ?catalog
```

Here, `{p:PK}` uses the alias `p` to refer to the `PK` of the `Product` type. The `AS` keyword works just like in SQL.

LEFT JOIN also works the same way:

```sql
SELECT {p:PK}, {m:code}
FROM {Product AS p
    LEFT JOIN Media AS m ON {p:picture} = {m:PK}}
```

## Ordering and Pagination

```sql
SELECT {PK} FROM {Product}
ORDER BY {code} ASC

SELECT {PK} FROM {Product}
ORDER BY {name[en]} DESC
```

Pagination is handled at the `FlexibleSearchQuery` object level, not in the query string:

```java
FlexibleSearchQuery fsQuery = new FlexibleSearchQuery(query);
fsQuery.setCount(20);   // page size
fsQuery.setStart(0);    // offset (0-based)
```

## Subqueries

Subqueries are supported too:

```sql
SELECT {PK} FROM {Product}
WHERE {catalogVersion} IN (
    {{
        SELECT {PK} FROM {CatalogVersion}
        WHERE {version} = ?catalogVersion
    }}
)
```

The double curly braces `{{ }}` wrap the subquery. This is how FlexibleSearch distinguishes a subquery from the outer query.

## Common Gotchas

**Localized attributes without a language**

If you select a localized attribute like `{name}` without specifying a language, you get a `Map` instead of a `String`. Use `{name[en]}` to get the English value directly, or handle the map in your code.

**Result class matters**

By default, `flexibleSearchService.search()` returns model objects. But if you `SELECT` specific attributes instead of just `{PK}`, you need to specify the result class:

```java
String query = "SELECT {code}, {name[en]} FROM {Product}";
FlexibleSearchQuery fsQuery = new FlexibleSearchQuery(query);
fsQuery.setResultClassList(List.of(String.class, String.class)); // one class per selected attribute

SearchResult<List<Object>> result = flexibleSearchService.search(fsQuery);
```

Each row comes back as a `List<Object>`, not as a model.

**Enums need special handling**

Enum attributes in FlexibleSearch are stored as their PK in the database. If you're filtering by an enum, pass the enum value directly as a parameter -- the platform handles the conversion:

```java
fsQuery.addQueryParameter("approvalStatus", ArticleApprovalStatus.APPROVED);
```

Don't try to pass the string name of the enum; it won't match.

**Generated SQL can surprise you**

If a query is slow or returning unexpected results, check the generated SQL in HAC. Sometimes the translation produces a query that's not what you had in mind, and seeing the actual SQL makes it obvious.

## Useful Queries for Day-to-Day Work

A few queries I find myself reaching for often:

**Find all products in a catalog version:**

```sql
SELECT {p:PK}, {p:code}, {p:name[en]}
FROM {Product AS p
    JOIN CatalogVersion AS cv ON {p:catalogVersion} = {cv:PK}
    JOIN Catalog AS c ON {cv:catalog} = {c:PK}}
WHERE {c:id} = 'myCatalog'
    AND {cv:version} = 'Staged'
ORDER BY {p:code} ASC
```

**Find all users with a specific user group:**

```sql
SELECT {u:PK}, {u:uid}
FROM {User AS u
    JOIN PrincipalGroupRelation AS pgr ON {pgr:source} = {u:PK}
    JOIN UserGroup AS ug ON {pgr:target} = {ug:PK}}
WHERE {ug:uid} = 'customergroup'
```

**Find all CMS components of a specific type:**

```sql
SELECT {PK}, {uid}, {name}
FROM {SimpleBannerComponent}
ORDER BY {modifiedtime} DESC
```

## Conclusion

FlexibleSearch covers most of what you'd need for querying data in SAP Commerce. The syntax takes a little getting used to, especially the curly braces and the subquery double-braces, but once it clicks it's fairly straightforward. The biggest thing to keep in mind is to always use query parameters, and when something looks off, check the generated SQL in HAC -- it saves a lot of guesswork.

I hope this helps. Let me know in the comments if you have any questions or if there's a specific FlexibleSearch topic you'd like me to cover in more detail.
