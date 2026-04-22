---
layout: article
title: "SAP Customer Data Platform (CDP): Pros, Limitations, and Architectural Implications"
description: "A review of SAP Customer Data Platform (CDP) based on months of experience, highlighting its strengths in customer 360 view and event-driven automation, along with its limitations."
keywords: "SAP CDP, SAP Customer Data Platform, Customer 360, CX Flows, Event-Driven Automation, Integration, Architecture"
date: 2026-04-22
date_modified: 2026-04-22
canonical_url: ""
canonical_source: ""
breadcrumb: "Articles"
breadcrumb_short: "SAP CDP Review"
permalink: /articles/sap-cdp-review-limitations
snippet: "A comprehensive review of SAP Customer Data Platform (CDP) after months of hands-on experience, detailing its powerful customer merging capabilities and critical architectural limitations."
snippet_id: "Ulasan komprehensif tentang SAP Customer Data Platform (CDP) berdasarkan pengalaman langsung, merinci kemampuan penggabungan datanya dan batasan arsitektur yang penting."
published: false
---


## Introduction

After working extensively with SAP Customer Data Platform (SAP CDP) over the past several months, I've gathered some important insights. Like any enterprise software, it has powerful capabilities that can transform how a business handles data, but it also comes with specific limitations that strongly influence architectural and operational decisions.

In this article, I want to share my thoughts on the biggest strengths of SAP CDP, as well as the operational constraints you need to prepare for when implementing it.

## The Good: Unified Profiles and Event-Driven Automation

The biggest pro of SAP CDP is undeniably its ability to merge customer data from multiple systems into a single customer record. In an enterprise environment, it's common for customers to exist as different IDs across various platforms. SAP CDP effectively resolves this by merging these disparate records into a unified profile. This provides the business with a genuine, real-time "Customer 360" view.

Beyond just storing data, SAP CDP offers excellent operational capabilities:

- **CX Flows:** These enable event-driven automation. For example, when new customer data is created or updated, follow-up actions can be triggered automatically to downstream systems. This makes the platform highly responsive.
- **Dynamic Segment Calculation:** The platform can calculate and update customer segments on the fly as data changes, ensuring that marketing and sales teams always have the most up-to-date audience lists.

## The Limitations: Transport, Auditing, and Strict Limits

While the core capabilities are strong, several limitations require careful planning during implementation:

### 1. No Built-in Transport Mechanism

There is no native transport mechanism to move configurations between environments (e.g., from Development to Staging, and then to Production). This requires highly disciplined change management. In our case, changes had to be documented externally and applied manually. Because it relies on human intervention, this process is highly prone to human error. A native transport mechanism would significantly reduce this risk and streamline deployments.

### 2. Strict Query Rate Limits

The platform enforces strict query rate limits, defaulting to around ~30 Queries Per Second (QPS). When designing integrations or data migration scripts, you must implement robust rate-limiting and throttling on your end to avoid being blocked or dropping requests.

### 3. Limited Audit Trail Visibility

While an audit trail exists, accessing it is not straightforward. It requires making multiple API calls to piece together what happened. Furthermore, the audit log doesn't clearly show what changed; rather, it simply logs whatever payload the frontend sends to the backend. A menu in the UI with detailed field-level changes would be a lot better for troubleshooting and compliance.

### 4. Strict Integration Contracts

SAP CDP imposes strict integration contracts on external systems. When SAP CDP calls out to an external system, it expects that system to respond within **<200ms**. If the external system takes longer, SAP CDP will retry a few times before ultimately deciding that the step has failed. This means any downstream system integrated with SAP CDP must be highly performant and likely needs to handle requests asynchronously.

## Conclusion

SAP CDP is a powerful tool for achieving a true Customer 360 view and driving event-driven architecture. The integration constraint (<200ms response time) is generally addressable with good middleware or asynchronous processing on the receiving end. 

However, it is hard to ignore the transport and audit log limitations. If you are planning to implement SAP CDP, you must invest heavily in external documentation, manual change management processes, and custom tools to handle auditing effectively.
