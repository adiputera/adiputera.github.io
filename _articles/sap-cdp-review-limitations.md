---
layout: article
title: "SAP Customer Data Platform (CDP): Pros, Limitations, and Architectural Implications"
description: "A review of SAP Customer Data Platform (CDP) based on months of experience, highlighting its strengths in customer 360 view and event-driven automation, along with its limitations."
keywords: "SAP CDP, SAP Customer Data Platform, Customer 360, CX Flows, Event-Driven Automation, Integration, Architecture"
date: 2026-03-10
date_modified: 2026-04-30
tags: [sap-cdp, customer-data-platform, architecture]
canonical_url: ""
canonical_source: ""
breadcrumb: "Articles"
breadcrumb_short: "SAP CDP Review"
permalink: /articles/sap-cdp-review-limitations
snippet: "A practical review of SAP Customer Data Platform (CDP) detailing its customer merging capabilities and the architectural constraints you need to plan for."
snippet_id: "Ulasan praktis tentang SAP Customer Data Platform (CDP) yang merinci kemampuan penggabungan datanya serta batasan arsitektur yang perlu Anda perhatikan."
published: true
---


## Introduction

After working with SAP Customer Data Platform (SAP CDP) over the past few months, I've gathered some practical takeaways. Like any enterprise software, it handles certain tasks well, but it also comes with hard constraints that will dictate your architectural and operational decisions.

In this article, I'll cover the main advantages of SAP CDP, as well as the operational limitations you need to prepare for when implementing it.

## The Good: Unified Profiles and Event-Driven Automation

The main advantage of SAP CDP is its ability to merge customer data from multiple systems into a single record. In most enterprise environments, customer data is scattered—your e-commerce system might use an email address, your CRM a phone number, and your marketing tool a device ID.

SAP CDP handles this fragmentation by continuously ingesting data and merging these records using identity resolution rules. This provides a real-time Customer 360 view, allowing teams to see a complete picture of the customer rather than disjointed pieces.

Beyond data storage, SAP CDP offers useful operational features:

- **CX Flows:** Workflows that trigger follow-up actions when customer data changes. For example, pushing a real-time notification to a downstream system the moment a user enters a new segment.
- **Dynamic Segment Calculation:** The platform recalculates customer segments on the fly as underlying data changes, replacing the need for overnight batch jobs.

## The Limitations: Transport, Auditing, and Strict Limits

While the core features work well, several limitations require careful planning:

### 1. No Built-in Transport Mechanism

There is no native transport mechanism or API to move configurations between environments (e.g., from Development to Staging, and finally to Production). In modern software engineering, we expect CI/CD pipelines to handle this.

With SAP CDP, every configuration change has to be documented manually and re-entered in the target environment. Because this process relies entirely on human intervention, it is prone to error and slows down deployments.

### 2. Strict Query Rate Limits

The platform enforces strict query rate limits, defaulting to around 30 Queries Per Second (QPS). For an enterprise platform handling large volumes of customer records, this is restrictive.

When designing inbound integrations or running data migrations, you cannot simply push data directly into the system. You have to build rate-limiting, batching, and throttling mechanisms on your middleware or sender applications so requests don't get dropped.

### 3. Limited Audit Trail Visibility

While an audit trail exists, interpreting it takes effort. It often requires making multiple API calls just to piece together what happened.

Furthermore, the audit log doesn't show the *delta* (what changed before and after an event). It simply logs the raw payload sent from the frontend to the backend. If you are trying to debug a specific data mutation, this isn't very helpful. A UI diff showing historical changes would make troubleshooting much easier.

### 4. Strict Integration Contracts

SAP CDP imposes strict integration contracts on external systems. When it makes an outbound call (such as triggering a webhook from a CX Flow), it expects the receiving system to respond within **<200ms**.

If the external system takes longer, SAP CDP will retry a few times before marking the step as failed. Very few downstream legacy systems can guarantee a <200ms response time consistently. You will almost certainly need to introduce an intermediary—such as a fast message queue (Kafka, RabbitMQ) or a serverless function—to quickly acknowledge the request and process the workload asynchronously.

## Conclusion

SAP CDP works well for building a Customer 360 view and event-driven marketing flows. The <200ms response constraint is usually solvable by placing middleware in front of your external systems.

However, the lack of configuration transport and the limited audit logs are harder to work around. If you are implementing SAP CDP, plan to spend time maintaining manual documentation, writing deployment runbooks, and building custom tools to handle auditing.
