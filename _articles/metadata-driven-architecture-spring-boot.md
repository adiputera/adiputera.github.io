---
layout: article
title: "Metadata-Driven Architecture in Spring Boot"
description: "How to build a dynamic schema registry in Spring Boot that safely autodiscovers domain models using the JPA Metamodel, caches reflection results, and maps raw JSON payloads into strongly typed Java entities."
keywords: "Spring Boot, Java, reflection, JPA Metamodel, metadata engine, dynamic schema, concurrent hash map, architecture"
date: 2026-08-16
date_modified: 2026-08-16
permalink: /articles/metadata-engine-spring-boot
tags: [architecture, spring-boot, java, headless-cms]
breadcrumb: "Articles"
breadcrumb_short: "Metadata-Driven Architecture"
snippet: "Designing a robust metadata engine in Spring Boot that evaluates domain classes at startup, caches field annotations, and translates dynamic JSON input into typed Java entities."
snippet_id: "Merancang mesin metadata di Spring Boot yang mengevaluasi kelas domain saat startup, menyimpan anotasi bidang dalam cache, dan menerjemahkan input JSON dinamis ke dalam entitas Java yang diketik."
image: /images/articles/metadata-driven-architecture-spring-boot/cover.webp
og_image_width: 1024
og_image_height: 1024
og_image_type: image/webp
published: false
mermaid: true
---

## Table of Contents
{: .no_toc}

* TOC
{:toc}

---

## Introduction

In modern application development, we frequently encounter the need to build dynamic interfaces. Whether you are building a rule engine, a dynamic survey generator, an internal administration tool, or a headless CMS, the underlying architectural problem is the same: the system must process data structures that are not known to the frontend at compile time.

An alternative approach is to maintain strongly typed Java classes as the source of truth, and build a "Metadata Engine" that exposes this schema to external clients. This article explores how to build a robust metadata engine in Spring Boot. It uses the JPA Metamodel to discover entities at startup, evaluates custom annotations via Java reflection, caches the results to eliminate runtime overhead, and safely translates flat JSON dictionaries into typed JPA entities.

> [!NOTE]
> This architectural pattern is a core component of the system built in our [Headless CMS Demo series](/tags/headless-cms/).

---

## Why Not Store Schemas in the Database?

A common approach to building dynamic applications is to store the entire schema definition in a database and generate tables or JSON blobs on the fly. However, this sacrifices the safety of a compiled language like Java. You lose static typing, foreign key constraints, and compile-time validation.

Here is how a metadata-driven approach compares to a database-driven schema:

| Database Schema | Metadata Engine |
|---|---|
| Runtime-defined | Compile-time-defined |
| No compiler validation | Compiler validation |
| Weak typing | Strong typing |
| Harder refactoring | IDE refactoring |
| Easy dynamic changes | Easier maintenance |

This is the core architectural decision: rather than pushing schema definitions into the database, we pull them into the codebase and expose them dynamically.

---

## 1. Designing the Metadata Contract

The foundation of a metadata engine is the declarative contract. We need a way for developers to annotate standard Java fields with presentation and validation rules. 

We define a custom annotation, `@MetadataField`, which allows engineers to describe how a field should behave dynamically:

```java
@Target(ElementType.FIELD)
@Retention(RetentionPolicy.RUNTIME)
public @interface MetadataField {
    String displayName();
    FieldType type() default FieldType.STRING;
    boolean required() default false;
    boolean editableOnUpdate() default true;
    boolean searchable() default false;
    boolean showAsColumn() default true;
    Class<? extends BaseEntity> targetEntity() default BaseEntity.class;
}
```

When an engineer creates a new persistence entity, they simply apply these annotations:

```java
@Entity
public class Product extends BaseEntity {

    @MetadataField(displayName = "Product Name", required = true, searchable = true)
    private String name;

    @MetadataField(displayName = "Price", type = FieldType.NUMBER, required = true)
    private BigDecimal price;
    
    // Getters and setters
}
```

Because the annotation retention is set to `RUNTIME`, the Spring Boot application can read these configuration values when it starts.

---

## 2. Safe Discovery via the JPA Metamodel

To build a registry of all available domain models, the backend must scan the application to find classes that extend our base entity (`BaseEntity`). 

A naive approach involves scanning the entire Java classpath using libraries like Reflections. However, classpath scanning is slow and can accidentally register classes that are not actually managed by the persistence context.

Instead, we rely on the JPA Metamodel. Since Hibernate already scans and initializes the persistence context during application startup, we can query the `EntityManager` directly for a list of all known entities.

```java
@Service
@RequiredArgsConstructor
public class MetadataRegistry {

    private final EntityManager entityManager;
    private final Map<String, TypeDescriptor> registry = new ConcurrentHashMap<>();

    @PostConstruct
    public void init() {
        for (EntityType<?> entityType : entityManager.getMetamodel().getEntities()) {
            Class<?> javaType = entityType.getJavaType();
            
            // Only register classes that inherit from our base domain contract
            if (javaType != null && BaseEntity.class.isAssignableFrom(javaType)) {
                registerType(javaType);
            }
        }
    }
}
```

This method ensures that only valid, database-backed entities are evaluated by the metadata engine.

---

## 3. The Registry and Caching Strategy

Java reflection is notoriously slow. Calling `Class.getDeclaredFields()` or `Method.invoke()` during a standard HTTP request degrades throughput and increases garbage collection pressure.

To eliminate reflection from the runtime execution path, the metadata registry evaluates all annotations exactly once during the `@PostConstruct` phase. It resolves the getter and setter methods for each field and stores them in a structured `TypeDescriptor` object.

> [!TIP]
> **Reflection at startup, metadata at runtime.** Evaluate once. Cache forever. O(1) lookup.

```java
private void registerType(Class<?> clazz) {
    String typeCode = clazz.getSimpleName().toLowerCase();
    List<FieldDescriptor> fields = new ArrayList<>();

    Class<?> current = clazz;
    while (current != null && current != Object.class) {
        for (Field field : current.getDeclaredFields()) {
            if (field.isAnnotationPresent(MetadataField.class)) {
                MetadataField ann = field.getAnnotation(MetadataField.class);
                
                // Resolve Method references once at startup
                Method getter = findGetter(clazz, field.getName(), field.getType());
                Method setter = findSetter(clazz, field.getName(), field.getType());

                FieldDescriptor fieldMeta = FieldDescriptor.builder()
                        .name(field.getName())
                        .type(ann.type())
                        .required(ann.required())
                        .getter(getter)
                        .setter(setter)
                        .build();
                        
                fields.add(fieldMeta);
            }
        }
        current = current.getSuperclass();
    }

    registry.put(typeCode, new TypeDescriptor(typeCode, clazz, fields));
}
```

The resulting `TypeDescriptor` objects are stored in a `ConcurrentHashMap`. When an API request arrives to fetch the schema or modify a record, the application performs an O(1) map lookup. Because the `Method` references are pre-resolved and cached, interacting with the entity dynamically incurs almost zero overhead compared to native method calls.

---

## 4. Translating JSON to Typed Entities

When a client submits data to create a new entity, they send a flat JSON dictionary. The metadata engine must safely translate this untyped map into a strongly-typed Java instance.

The `GenericEntityMapper` handles this translation by iterating over the incoming JSON keys, looking up the corresponding cached `FieldDescriptor`, and invoking the pre-resolved setter method.

```java
public void populateEntity(Object entity, Map<String, Object> payload, TypeDescriptor typeMeta) {
    for (FieldDescriptor fieldMeta : typeMeta.getFields()) {
        String fieldName = fieldMeta.getName();
        
        if (payload.containsKey(fieldName)) {
            Object rawValue = payload.get(fieldName);
            
            // Handle type conversions (e.g. String to BigDecimal, Integer to Long)
            Object convertedValue = fieldMeta.getValueConverter().convert(rawValue);
            
            try {
                fieldMeta.getSetter().invoke(entity, convertedValue);
            } catch (Exception e) {
                throw new BadRequestException("Failed to set field " + fieldName);
            }
        }
    }
}
```

Because the iteration is driven by the cached `typeMeta.getFields()` rather than the keys in the user's JSON payload, the engine naturally ignores extraneous data submitted by malicious clients. It only attempts to populate fields explicitly marked with `@MetadataField`.

---

## 5. Who Should Use This?

A metadata engine provides immense value for standardized data entry, generic CRUD interfaces, and dynamic schema resolution. However, not every application needs this.

**Good Fit:**
* Admin portals
* Internal CRUD tools
* Content Management Systems (CMS)
* ERP systems
* Rule engines
* Survey builders

**Poor Fit:**
* Banking core systems (where explicit code provides necessary auditability)
* Highly customized workflows and multi-step wizards
* Performance-critical domain logic 

## Conclusion

By treating Java classes as the source of truth and exposing their schema through a metadata engine, backend teams can build highly dynamic, extensible systems without sacrificing static typing or compile-time safety. 

Using the JPA Metamodel for discovery guarantees that only valid entities are processed. Evaluating annotations and resolving methods during application startup eliminates runtime reflection penalties. The result is a fast, safe, and generic pipeline capable of powering any frontend that understands the metadata contract.
