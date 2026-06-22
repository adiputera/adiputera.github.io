---
layout: article
title: "ImpEx in SAP Commerce (SAP Hybris): Patterns and Gotchas"
description: "A practical guide to ImpEx in SAP Commerce (SAP Hybris), covering the syntax, common patterns, modes, and the pitfalls that catch every developer at least once."
date: 2026-04-28
date_modified: 2026-04-28
keywords: "SAP Commerce, SAP Hybris, ImpEx, Data Import, HAC, Macros, Localized Attributes, Java Engineer, Hybris Development"
tags: [sap-commerce, impex, data-import]
permalink: /articles/impex-patterns-sap-commerce
breadcrumb: "Articles"
breadcrumb_short: "ImpEx Patterns"
snippet: "A practical guide to ImpEx in SAP Commerce (SAP Hybris), covering the syntax, the four modes, the patterns I reach for daily, and the gotchas that have cost me more debugging time than I'd like to admit."
snippet_id: "Panduan praktis ImpEx di SAP Commerce (SAP Hybris), mencakup sintaks, empat mode utama, pola yang sering dipakai sehari-hari, dan beberapa gotcha yang sering memakan waktu debugging."
image: /images/articles/impex-patterns-sap-commerce/cover.webp
og_image_width: 1024
og_image_height: 1024
og_image_type: image/webp
canonical_url: ""
canonical_source: ""
published: false
---

## The Background

If you've worked on SAP Commerce (SAP Hybris) for more than a week, you've already touched ImpEx. It is the platform's data-import DSL, and it shows up everywhere: initial data setup during system build, content updates from business users, batch migrations between environments, cronjob inputs, and even inside JUnit fixtures. Anything that creates or updates items in the type system goes through ImpEx eventually.

The syntax looks simple at first glance, just CSV with a header line, but there's a fair amount happening underneath. ImpEx talks to the type system, not directly to the database, so it understands attributes, references, localized values, collections, and modes in a way plain SQL never could. That power comes with a few sharp edges.

This guide covers the parts I use the most, the patterns that keep ImpEx files readable, and the gotchas that have cost me debugging time so you don't have to learn them the same way.

## How ImpEx Works

An ImpEx file is just a sequence of header lines followed by data lines. The header tells the platform which type to operate on, which mode to use, and which attributes the columns map to. The data lines fill in the values.

```impex
INSERT_UPDATE Product;code[unique=true];name[lang=en];description[lang=en]
;HW1000-S01;Smartphone X10;A flagship smartphone with a great camera
;HW1000-S02;Smartphone X20;A mid-range smartphone with solid battery life
```

The semicolon at the start of every data line is intentional. It is the first column, and ImpEx expects it because the header itself starts with the mode keyword and is comma-free. Skip it and the row simply won't parse.

There are four modes you'll meet:

- `INSERT` — create new items only. Fails if the unique key already exists.
- `UPDATE` — update existing items only. Fails if the unique key doesn't exist.
- `INSERT_UPDATE` — upsert. Creates if missing, updates if present. The default choice for most data files.
- `REMOVE` — delete items matching the unique key.

The unique attribute (or combination of attributes) is what ImpEx uses to decide if a row is an insert or an update. You mark it with `[unique=true]` on the header. Get this wrong and you can silently overwrite the wrong rows, which is the first gotcha I want to call out later.

## Patterns Worth Knowing

### Macros

Macros let you give a long expression a short name and reuse it across the file. They start with a `$` and are defined with `=`:

```impex
$catalogVersion=catalogVersion(catalog(id[default=apparelProductCatalog]),version[default=Staged])[unique=true]
$lang=en

INSERT_UPDATE Product;code[unique=true];$catalogVersion;name[lang=$lang]
;HW1000-S01;;Smartphone X10
;HW1000-S02;;Smartphone X20
```

Two things I want to flag here. The macro can include modifiers like `[unique=true]` and `[default=...]`, which is exactly how you keep `catalogVersion` out of every data row. And the second use of the macro inside `[lang=$lang]` shows that macros expand inside header expressions too, which is useful when you generate one ImpEx file per locale.

### Localized attributes

Most of the user-facing attributes on `Product`, `Category`, and CMS items are localized. You target a specific locale with `[lang=...]`:

```impex
INSERT_UPDATE Product;code[unique=true];name[lang=en];name[lang=id]
;HW1000-S01;Smartphone X10;Telepon Pintar X10
;HW1000-S02;Smartphone X20;Telepon Pintar X20
```

Each locale is its own column. You can also drop `[lang=...]` entirely and the platform will use the session locale, but I avoid that because it makes the file environment-dependent.

### Referencing items by unique attribute

When an attribute is itself a reference to another item, you don't pass a PK. You pass the unique attributes of the referenced item, in parentheses:

```impex
INSERT_UPDATE Product;code[unique=true];$catalogVersion;supercategories(code, $catalogVersion)
;HW1000-S01;;phones
;HW1000-S02;;phones,featured
```

The `supercategories` column references `Category` items. ImpEx looks them up by `code` plus their own `catalogVersion`. The comma-separated list in the second row sets two categories at once. This nested-lookup syntax is what makes ImpEx so much more pleasant to write than raw SQL — you describe relationships in terms of business keys, not surrogate IDs.

### Collections and translators

Some attributes are collections of primitives (a list of strings, a set of enums) rather than references. For those you use a translator on the column header:

```impex
INSERT_UPDATE Product;code[unique=true];$catalogVersion;keywords[translator=de.hybris.platform.impex.jalo.translators.LineBreakCollectionTranslator]
;HW1000-S01;;flagship\ncamera\n5G
;HW1000-S02;;mid-range\nbattery\nlte
```

The `\n` in the data is the value separator the translator expects. There are several translator classes shipped with the platform — this is the one I use most for keyword-style lists.

### The `if` header

Less commonly used but very handy: `if` lets you run a row only when a condition holds. The condition is Groovy:

```impex
"#%groovy% if(de.hybris.platform.servicelayer.config.ConfigurationService.getConfiguration().getString('environment') == 'prod') { return 'true'; } else { return 'false'; }"

INSERT_UPDATE Product;code[unique=true];onlineDate[dateformat=yyyy-MM-dd]
;HW1000-S01;2026-05-01
```

I use this for environment-specific data — staging-only test products, debug categories that shouldn't reach production. Keeping the gate inside the file means there is one source of truth instead of two parallel files that drift apart.

## Gotchas

### Wrong unique attribute silently overwrites the wrong rows

This is the one that has burned me the most often. Consider:

```impex
INSERT_UPDATE Product;name[lang=en][unique=true];code
;Smartphone X10;HW1000-S01
;Smartphone X10;HW1000-S99
```

`name` is not a unique attribute, but ImpEx will happily accept it as one. The second row matches the first, so it overwrites the `code` of the existing product instead of creating a new one. You realise something is off when SKUs vanish from search.

Always double-check that the columns marked `[unique=true]` actually identify a single item.

### `INSERT_UPDATE` without a unique attribute

If you forget `[unique=true]` entirely, ImpEx falls back to creating a new item for every row. On a fresh environment this looks fine — the rows insert, no errors. On a re-run, you get duplicates and silently broken data. The header line should always declare its uniqueness.

### Localized attribute typos fail silently

`[lang=en_US]`, `[lang=en_GB]`, `[lang=en]` — not interchangeable. If the locale isn't registered in your platform, ImpEx will skip the column instead of erroring out. Your data line writes nothing for that attribute, the import shows green, and you only notice when the storefront renders blanks.

The fix is to keep an explicit list of supported locales somewhere central and grep for stray ones in your ImpEx files before merging.

### `$config-` macros only work in HAC

The `$config-myproperty` macro reads from your platform configuration at import time. It works beautifully in the HAC import console, where the platform context is fully wired. It also works in ImpEx files imported by the system update process. It does NOT always work the same way in custom Groovy scripts that invoke the import service themselves, because the macro resolution depends on the import context being initialised.

When in doubt, resolve the value in your script and pass it as a regular macro at the top of the generated ImpEx string.

### CSV quoting and embedded commas

Product descriptions love commas, and ImpEx will treat them as column separators unless you quote the field with double quotes:

```impex
INSERT_UPDATE Product;code[unique=true];description[lang=en]
;HW1000-S01;"A flagship smartphone, with a great camera, and 5G."
```

Double quotes inside the field need to be doubled (`""`). The smaller gotcha hiding in here is that some text editors and Excel exports use smart quotes, which ImpEx does not understand. If a row mysteriously refuses to parse, paste it into a hex viewer and look for `0xE2 80 9C` (left smart quote) before blaming the platform.

### Catalog version sync timing

You import to the Staged version, the data lands fine, and the storefront still shows yesterday's content. The fix is the catalog sync cronjob, which copies Staged to Online — and that is a separate step. If your project automates imports, make sure the sync runs after the import finishes, not before.

## Tips

A few habits that have saved me time:

1. **Test in HAC first.** Paste the file into the HAC import console with "validate only" before you commit it. Validation catches almost every header-level mistake.
2. **Keep one logical change per file.** If you bundle a category restructure with a product import, a single bad row blocks both. Smaller files roll back cleanly.
3. **Comment heavily.** Lines starting with `#` are ignored. Use them as section markers — `# === categories ===`, `# === product references ===` — so future-you can navigate the file at a glance.
4. **Generate, don't hand-edit.** For anything more than a few hundred rows, write a small script that emits the ImpEx from a CSV or spreadsheet. Hand-editing tabular data is where typos breed.

## Conclusion

ImpEx is one of those tools that you stop noticing once you're fluent. It just does the boring work of moving data into the type system, and the syntax fades into the background. The trick is getting past the gotchas — the silent overwrites, the typo'd locales, the missing `[unique=true]` — without losing a day of your life to each one.

The patterns above cover the 90% of cases I run into on a typical SAP Commerce project. There's a long tail of advanced features (custom translators, processors, the cell decorators) that I haven't touched here, but the basics will carry you a long way.

I hope this helps. Let me know in the comments if you have any questions or if there's a specific ImpEx pattern you'd like me to cover in more detail.
