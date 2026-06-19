---
layout: article
title: "Migrating SAP Commerce from HANA to MySQL Without Official Tooling"
description: "How we migrated two SAP Commerce projects from HANA to MySQL in 2019-2020 using a custom cronjob, cutting database costs by 73% before SAP Commerce DB Sync existed."
keywords: "SAP Commerce migration, SAP Hybris HANA to MySQL, SAP Commerce DB Sync, custom migration cronjob, JDBC batching, items.xml schema, SAP Commerce cost reduction"
date: 2026-05-17
date_modified: 2026-05-17
permalink: /case-studies/sap-commerce-hana-to-mysql-migration
category: case-study
tags: [sap-commerce, database-migration, mysql, hana]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "SAP Commerce DB Migration to MySQL"
snippet: "Migrating two SAP Commerce projects from HANA to MySQL using a custom bulk-copy cronjob, achieving a 73% reduction in database costs."
snippet_id: "Memigrasi dua proyek SAP Commerce dari HANA ke MySQL menggunakan cronjob kustom, menghasilkan penghematan biaya database hingga 73%."
image: /images/articles/case-study-sap-hana-mysql-migration/cover.webp
og_image_width: 1024
og_image_height: 1024
og_image_type: image/webp
published: true
---

## The Background

In late 2019, we had two SAP Commerce 6.6 projects, both running on SAP HANA. In both cases, we assumed we had to use HANA simply because it was an SAP system. And HANA wasn't cheap.

SAP Commerce officially supports four databases: HANA, Oracle, SQL Server, and MySQL. MySQL was the cheapest option of the four, so that's where we wanted to land.

The blocker was that there was no official tool for this. No [SAP Commerce DB Sync](https://github.com/SAP/sap-commerce-db-sync) yet.

We could have hired a third-party vendor to handle the migration for us, but that would have meant another sizeable bill on top of the one we were trying to escape. The point of moving off HANA was to cut costs, not just move them sideways. So we built it ourselves.

We started exploring options, looking at ETL tools and other approaches before landing on the custom cronjob solution. By March 2020, both projects were running on MySQL in production.

## The Approach: Building a Custom Migration Job

With no off-the-shelf tool, I built the migration directly inside SAP Commerce as a cronjob.

The first step was the schema. Instead of trying to translate HANA DDL into MySQL DDL by hand, I pointed a fresh SAP Commerce build at an empty MySQL instance and let the platform's normal initialization create the schema for me. The platform already knows how to create its own tables on every supported database, so there was no reason to re-derive that knowledge.

This matters more than it sounds. In SAP Commerce you never declare a column type. You declare an attribute type in `items.xml` (`type="java.lang.String"`, `type="java.lang.Integer"`, and so on), and the platform translates that to the right physical column per database at initialization time. So when the platform built the schema in MySQL, it gave us a trustworthy target shape based on the same item model, instead of forcing us to hand-map every HANA column to a MySQL equivalent. The migration job could mostly shuttle `getObject` → `setObject` and let the platform's own abstraction do the heavy lifting. No manual type mapping. No HANA-NVARCHAR-vs-MySQL-VARCHAR debugging.

Once the schema was in place, the cronjob took over. One thing worth pointing out: the job fetched its table list from the *target* database, not the source, using `information_schema`:

```sql
SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA = 'target_schema';
```

That choice doubled as a cleanup pass. If a table existed in HANA but didn't exist in the freshly-initialized MySQL schema, we treated it as meaning the current codebase no longer used it, so there was no reason to migrate it.

When I compared the two schemas, HANA had maybe two or three extra tables that MySQL didn't. Rather than investigate whether they still mattered, I just let the target schema be the source of truth. Driving the loop from the target side meant we only moved data the platform still cared about, at the table level, at least. Columns turned out messier, which I'll get to.

For each of those tables, the job ran a `SELECT * FROM table_name` against the source HANA database, one table at a time.

### Batching and Memory Management

Moving millions of rows means you can't load a whole table into memory at once. On the read side, I set the JDBC fetch size small (`setFetchSize(100)`) so the driver streamed rows from HANA instead of buffering the full result set and blowing up the JVM. The 100 was honestly a magic number. Small enough that the JVM stayed comfortable, big enough that round-trips didn't crush throughput. I didn't tune it.

On the write side, the job truncated the target table first, then inserted in batches of 1,000 rows via JDBC batching. Indexes and constraints were still active during the load. That made the job simpler and avoided foreign-key/order-of-table problems in practice, but it also made the load slower than it needed to be. The logic was based on [this StackOverflow answer](https://stackoverflow.com/a/29720809/3603194). A sanitized version of the core loop:

```java
// Prepare dynamic insert statement based on column metadata
psTarget = target.prepareStatement("INSERT INTO " + table + "("
        + columns.stream().collect(Collectors.joining(", ")) + ") VALUES ("
        + columns.stream().map(s -> "?").collect(Collectors.joining(", ")) + ")");

int rowCount = 0;
while (resultSet.next()) {
    // Set each column value from the source row
    for (int i = 1; i <= metaData.getColumnCount(); i++) {
        psTarget.setObject(i, resultSet.getObject(i));
    }
    
    psTarget.addBatch();
    rowCount++;
    
    // Execute batch every 1,000 rows to keep memory footprint low
    if (rowCount == 1000) {
        psTarget.executeBatch();
        psTarget.clearBatch();
        rowCount = 0;
    }
}

// Flush remaining rows
if (rowCount > 0) {
    psTarget.executeBatch();
}
```

## What Actually Went Wrong

Two real-world issues showed up that the abstract design didn't account for.

**MySQL database charset.** A setup-level miss on our side. The MySQL instance had been provisioned with a non-`utf8mb4` default charset, and SAP Commerce content (especially anything multilingual) doesn't survive that. This isn't something the platform's type abstraction can catch. Charset is a database-level setting that sits below the column layer. We hit it mid-load and had to fix the database charset before continuing:

```sql
SET NAMES utf8mb4;
ALTER DATABASE db_name CHARACTER SET = utf8mb4 COLLATE = utf8mb4_general_ci;
```

After the charset fix, we threw away the in-progress data and restarted the load from scratch, which sounds expensive but wasn't. The job was idempotent by construction: schema initialization happened exactly once on an empty MySQL instance, and every subsequent run was just truncate-then-reload. No resumability, no checkpoints. Restart was the recovery strategy. That kept the job small and meant fixes like this one cost us time, not state.

**Source columns that didn't exist on target.** A few HANA tables carried legacy columns that the current `items.xml` no longer declared, so they were absent in the freshly-initialized MySQL schema. The bulk insert tried to write them and failed. Fix was a manual `ALTER TABLE` on the target to add the missing column back, then re-run the job. The earlier "drop tables that don't exist on target" rule didn't apply at the column level. We handled these case by case rather than building auto-detection for a one-off migration.

## The Results

The migration worked, and the bill dropped the next cycle.

Moving off HANA onto MySQL **cut our database costs by roughly 73%** (license plus DB infrastructure combined). HANA had been the dominant line item in that bucket; MySQL replaced it on much cheaper footing.

The database was not huge by enterprise-commerce standards. The customer table was around 500,000 rows, and the rest of the data was manageable enough that a full reload was still a realistic recovery strategy. Media files were not part of this migration. We only moved database content.

We load-tested the new MySQL instance before flipping production. The test was deliberately write-focused, hammering the customer registration API to stress the database under realistic write load. Throughput came out roughly on par with HANA. No meaningful regression. So we got the cost cut without giving up speed.

The application stayed on HANA during the bulk copy. The cronjob read from the live source and wrote into MySQL over about 20 hours per project, scheduled into a low-traffic window. Writes kept landing on HANA the whole time: orders, carts, sessions, the usual.

After the job is done, we compare the rows in both databases, for delta records, we will check the records based on `modifiedDate`. For newly-created SAP Commerce records `creationDate` equals `modifiedDate`, so a single timestamp filter gave us the delta cleanly. We copied those rows across by hand and flipped the datasource config to MySQL.

Not glamorous, but the alternative was writing a delta-sync job for a one-off migration. The manual pass took less time than building one.

## Why It Generalized

We ran the same cronjob for both projects. Same code, no modifications.

In practice the two schemas weren't dramatically different. SAP Commerce ships hundreds of OOTB tables, and when you customize, you mostly extend existing item types, which the platform materializes as extra columns appended to the OOTB tables rather than as new tables. So most of the table set was shared; the divergence was in the columns.

But that's just what happened to be true here. The job would have worked even if the two projects had wildly different table sets. Say one project was bigger with entirely different custom item types and dozens of new tables of its own. Nothing in the job was hard-coded to a schema. Tables came from `information_schema` at runtime. Columns came from `ResultSetMetaData` at runtime. The schema itself was built by SAP Commerce's `initialize` step from each project's own `items.xml`. The job moved bytes; the platform took care of knowing what those bytes were and where they went.

## Lessons Learned

A few things I'd carry into the next migration:

- **Let the platform create its own schema.** Booting SAP Commerce against an empty MySQL instance gave us the right target schema for the current item model, with no hand-mapping from HANA. The platform already knows how to do it. Use that.
- **Drive table enumeration from the target.** Pulling the table list at runtime from the target made the same job work across two projects with different customizations, with zero hard-coded schema knowledge. Column differences still needed a few case-by-case fixes.
- **Set the DB charset before init.** Provisioning the MySQL instance with `utf8mb4` from the start would have saved us a full restart of the bulk copy.
- **Make restart the recovery strategy.** Truncate-then-reload kept the job small, and meant every fix (including the charset one) cost us time, not state. We didn't build resumability for a one-off migration.
- **Drop indexes during load, recreate after.** I didn't do this. Inserting into a fully-indexed schema ate a chunk of the 20-hour window. Next time, I'd defer index creation until after the data was in.
- **Go multithreaded next time.** My cronjob processed one table at a time, sequentially. It worked, but the whole migration took about 20 hours. If I did this again, I'd run multiple target tables in parallel and cut that window down significantly.

SAP eventually shipped the official [SAP Commerce DB Sync](https://github.com/SAP/sap-commerce-db-sync) tool, which is what I'd use if the migration was planned this year. But I don't regret building it. Is the solution perfect? No. Does it work? Yes. That was enough.
