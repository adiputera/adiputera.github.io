---
layout: article
title: "Orchestrating a Place-Order Flow Across Five Spring Boot Services with Temporal"
description: "Walk through a Spring Boot + Temporal sample that orchestrates a place-order flow across five services with no HTTP calls between them - each service runs its own Temporal worker on a dedicated task queue."
keywords: "Temporal, Spring Boot, Java, Microservices, Workflow Orchestration, Saga, Task Queue, temporal-spring-boot-starter"
date: 2026-04-24
date_modified: 2026-04-24
permalink: /articles/spring-temporal-multi-service-order-flow
breadcrumb: "Articles"
breadcrumb_short: "Spring Temporal Orchestration"
snippet: "A walk-through of a Spring Boot sample project where five services coordinate a place-order flow entirely via Temporal - no HTTP between services, each service owns its own task queue, and the workflow itself is the transport."
snippet_id: "Penjelasan sebuah proyek sampel Spring Boot di mana lima service mengorkestrasi alur place-order sepenuhnya melalui Temporal - tidak ada panggilan HTTP antar service, setiap service memiliki task queue sendiri, dan alur kerja itu sendiri yang menjadi transport."
published: true
---

> **Disclaimer:** The [spring-boot-temporal](https://github.com/adiputera/spring-boot-temporal) project referenced in this article is a simplified, dummy sample. It is designed specifically to demonstrate the workflow and orchestration concepts, not to serve as production-ready business logic.

## The Background

On a typical microservices codebase, when `order-service` needs `email-service` to send an email, it makes an HTTP call. That call is synchronous, the caller has to retry on failure, and if the receiver is down the caller has to decide what to do about it. Multiply that by four or five services downstream of an order and you end up hand-rolling retry, timeout, compensation, and observability for every hop.

Temporal flips the model. Instead of services calling each other directly, a **workflow** owns the business process, and each service contributes **activities** (leaf work) or **signals** (external events) through a Temporal worker. The workflow's history - every signal, every activity start, every timer - is persisted by Temporal, so retries, timeouts, and resumes are handled by the framework instead of application code.

I built a sample project, **[spring-boot-temporal](https://github.com/adiputera/spring-boot-temporal)**, to make this concrete: a five-service `place-order` flow where no service calls another over HTTP. Every inter-service hop goes through Temporal. This article walks through the shape of that project and the three architectural decisions that matter most.

## The Stack

- **Spring Boot 4.0.5** on **Java 25**
- **Temporal Java SDK 1.32.1** via `temporal-spring-boot-starter`
- **Postgres 16** (for Temporal's own state)
- **Docker Compose** to bring the whole thing up in one command

## The Modules

Six Maven modules under a single parent, five of which are Spring Boot services:

- **common** - shared DTOs, `TaskQueues` constants, and Temporal interfaces (no Spring Boot).
- **order-service** - exposes `POST /place-order`, owns the parent `OrderWorkflow`.
- **email-service** - no public API, just a worker that implements `EmailActivities`.
- **payment-service** - exposes `POST /payment` (a signal endpoint) and a `checkPayment` activity worker.
- **consignment-service** - owns the child `ConsignmentWorkflow` and the shipping activity worker.
- **cms-service** - operational endpoints (list, detail, reset, cancel, terminate) for humans looking at workflows.

A Temporal server (`temporal:7233`) and Temporal UI (`localhost:8080`) sit in the middle. Every service connects only to Temporal - not to each other.

## Three Architectural Decisions

### 1. One Task Queue per Service

Temporal lets many workers share a cluster, and it uses **task queues** to decide which worker gets which work. The sample declares four queues as constants in `common/src/main/java/id/adiputera/common/TaskQueues.java`:

```java
public final class TaskQueues {
    public static final String ORDER_TQ = "order-tq";
    public static final String EMAIL_TQ = "email-tq";
    public static final String PAYMENT_TQ = "payment-tq";
    public static final String CONSIGNMENT_TQ = "consignment-tq";
}
```

Each service's `application.yml` registers its worker on exactly one of these queues. Then inside the workflow, activity stubs are pinned to the task queue of the service that owns them:

```java
private final EmailActivities email = Workflow.newActivityStub(
        EmailActivities.class,
        ActivityOptions.newBuilder()
                .setTaskQueue(TaskQueues.EMAIL_TQ)
                .setStartToCloseTimeout(Duration.ofSeconds(30))
                .build());
```

The workflow runs in `order-service`, but when it calls `email.sendOrderPlacedNotification(...)` Temporal routes the activity to `email-tq`, where `email-service`'s worker picks it up. Zero HTTP. The workflow just calls a method.

### 2. A `common` Module for Contracts, Not Code

Temporal requires the exact **same interface** on both sides of every stub/implementation pair. If `order-service` builds a stub of `EmailActivities` and `email-service` implements a slightly different `EmailActivities` (say someone renamed a method), the stub compiles, the worker starts, and calls blow up at runtime with "unknown activity type".

The sample avoids that by keeping every Temporal interface in a shared `common` module:

- `TaskQueues` - task-queue name constants.
- `dto/PlaceOrderRequest`, `dto/ConsignmentResult` - inputs and outputs.
- `workflow/OrderWorkflow`, `workflow/ConsignmentWorkflow` - `@WorkflowInterface` contracts.
- `activity/EmailActivities`, `activity/PaymentActivities`, `activity/ShippingActivities` - `@ActivityInterface` contracts.

No service logic lives in `common` - just the types every side of every Temporal interaction must agree on. `order-service/pom.xml` depends on `common`, not on `email-service`. You can redeploy either side independently as long as the contract doesn't change.

### 3. Signals, Not Callbacks

When the customer pays, someone has to tell the workflow. Option A is polling (workflow wakes up every N seconds and asks payment-service if payment arrived) - wasteful. Option B is a callback URL - couples payment-service back to order-service over HTTP. Temporal's answer is a **signal**:

```java
@WorkflowInterface
public interface OrderWorkflow {
    String SIGNAL_PAYMENT_RECEIVED = "paymentReceived";

    @WorkflowMethod
    void placeOrder(PlaceOrderRequest request);

    @SignalMethod(name = SIGNAL_PAYMENT_RECEIVED)
    void paymentReceived();
}
```

In `payment-service/src/main/java/id/adiputera/payment/api/PaymentController.java`, `POST /payment?orderId=1001` translates to:

```java
workflowClient
    .newUntypedWorkflowStub("order-" + orderId)
    .signal(OrderWorkflow.SIGNAL_PAYMENT_RECEIVED);
```

Temporal persists the signal in the workflow's history, then routes a task back to the worker running `OrderWorkflowImpl`. Inside the workflow, the signal handler flips a field, and the workflow's `Workflow.await(Duration.ofMinutes(1), () -> paymentReceived)` unblocks. If the signal never arrives, the 1-minute timer fires instead. Either way, the workflow's history records what happened, durably.

## The Happy Path

Putting it together, `orderId=1001` produces this trace:

```
POST /place-order 1001           (order-service controller)
ORDER PLACED: 1001                (OrderWorkflow, order-tq)
sendOrderPlacedNotification 1001  (EmailActivities, email-tq)
POST /payment 1001                (payment-service controller → signal)
PAYMENT SIGNAL RECEIVED 1001      (OrderWorkflow resumes)
sendPaymentCompletedNotification  (EmailActivities, email-tq)
CONSIGNMENT STARTED 1001          (child ConsignmentWorkflow, consignment-tq)
... (child drives the rest) ...
WORKFLOW COMPLETED 1001           (parent resumes, workflow method returns)
```

Every line above is a distinct event in the workflow's Temporal history. If `email-service` is down when `sendOrderPlacedNotification` runs, Temporal retries the activity until the worker is back. If `order-service` crashes halfway through, Temporal resumes the workflow from history on another instance. None of that is application code.

## Running It

The whole thing boots with Docker Compose:

```bash
docker compose up --build
```

That brings up Postgres, the Temporal server, the Temporal UI, and the five Spring Boot services. Then:

```bash
curl -X POST localhost:8081/place-order \
  -H 'Content-Type: application/json' \
  -d '{"orderId":"1001"}'
curl -X POST 'localhost:8083/payment?orderId=1001'
```

Open `http://localhost:8080` to watch the workflow's history build up event by event.

## Conclusion

The "five services, no HTTP between them" part isn't a gimmick - it's a by-product of letting Temporal own the orchestration. Once the workflow is the source of truth for the business process:

- **Task queues** replace service discovery and load balancing.
- **Activity stubs** replace HTTP clients, complete with retry policies declared at the call site.
- **Signals** replace webhooks and callback URLs.
- **Shared contracts** (a `common` module) replace the per-service DTO duplication you usually end up with.

What's left in each service is the piece of business logic that actually belongs to it - sending emails in `email-service`, taking payments in `payment-service` - with no boilerplate to glue them together.

The next two articles in this series cover two specific patterns from the same project: handling signal-or-timeout with `Workflow.await`, and running a blocking child workflow for saga compensation.
