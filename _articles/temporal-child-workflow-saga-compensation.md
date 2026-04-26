---
layout: article
title: "Saga Compensation in Temporal: Refunding an Undelivered Order with a Child Workflow"
description: "How to run a blocking child workflow in Temporal, inspect its result, and run compensation activities in the parent when the child returns a failure outcome."
keywords: "Temporal, Saga Pattern, Child Workflow, Compensation, Spring Boot, Java, Workflow Orchestration"
date: 2026-04-27
date_modified: 2026-04-27
permalink: /articles/temporal-child-workflow-saga-compensation
breadcrumb: "Articles"
breadcrumb_short: "Temporal Saga Child Workflow"
snippet: "A saga pattern worked out in code: a parent workflow dispatches a child consignment workflow, blocks until it returns, and runs refund + cancellation activities if the child reports an undelivered outcome."
snippet_id: "Pola saga yang dikerjakan dalam kode: workflow induk memanggil child workflow pengiriman, menunggu hasilnya, lalu menjalankan aktivitas refund + pembatalan jika child melaporkan status tidak terkirim."
published: true
---

> **Disclaimer:** The [spring-boot-temporal](https://github.com/adiputera/spring-boot-temporal) project referenced in this article is a simplified, dummy sample. It is designed specifically to demonstrate the workflow and orchestration concepts, not to serve as production-ready business logic.

## The Problem

An order is placed, payment clears, the parcel is shipped - and then the courier can't deliver it. The business outcome is clear: refund the customer and email them that the order was cancelled. The engineering question is where that logic lives.

Option A: the service that detects the failed delivery calls `POST /refund` on the payment service and `POST /send-email` on the email service. That works until the refund succeeds but the email call times out - now the customer is out of product *and* unaware that anything was refunded. You write a retry loop. Then the retry loop crashes mid-way. You add a DLQ. And so on.

Option B: model the business process as a workflow, model the fulfilment sub-process as a **child workflow**, and put the compensation in the parent. When the child returns a failure result, the parent runs refund + email as ordinary activities. Retry, idempotency, and resume-on-crash are handled by Temporal.

This article walks through Option B, implemented in the [spring-boot-temporal](https://github.com/adiputera/spring-boot-temporal) sample.

## The Shape of the Parent

The parent is `OrderWorkflow`, implemented in `order-service/src/main/java/id/adiputera/order/workflow/OrderWorkflowImpl.java`. After payment succeeds, it starts the child and blocks on it:

```java
if (paid) {
    ConsignmentResult consignmentResult = runConsignment(orderId);
    if (consignmentResult == ConsignmentResult.UNDELIVERED) {
        payment.refundPayment(orderId);
        email.sendOrderCancelledNotification(orderId);
    }
}

private ConsignmentResult runConsignment(String orderId) {
    ConsignmentWorkflow consignment = Workflow.newChildWorkflowStub(
            ConsignmentWorkflow.class,
            ChildWorkflowOptions.newBuilder()
                    .setWorkflowId("consignment-" + orderId)
                    .setTaskQueue(TaskQueues.CONSIGNMENT_TQ)
                    .setWorkflowRunTimeout(Duration.ofMinutes(20))
                    .build());
    return consignment.startConsignment(orderId);
}
```

Two things stand out:

- **The child lives on a different task queue.** `CONSIGNMENT_TQ` is polled only by `consignment-service`'s worker. The parent worker in `order-service` doesn't need to know how delivery is checked - it just dispatches the workflow type and waits for the result.
- **The child's workflow id is deterministic (`consignment-{orderId}`).** This matters: if the parent is replayed, Temporal uses the same id, which means the same child execution - no duplicate fulfilment. Deterministic ids are the idempotency key.

The call `consignment.startConsignment(orderId)` looks synchronous, and for the parent it is - the parent doesn't resume until the child returns. But "synchronous" in workflow-land means "the parent is suspended and its history records that it's waiting on a child". The parent worker is free to pick up other workflows in the meantime.

## The Shape of the Child

The child is `ConsignmentWorkflow`, implemented in `consignment-service/src/main/java/id/adiputera/consignment/workflow/ConsignmentWorkflowImpl.java`:

```java
@Override
public ConsignmentResult startConsignment(String orderId) {
    Workflow.await(() -> shipmentDispatched);

    Workflow.sleep(Duration.ofMinutes(2));
    boolean delivered = shipping.checkShipping(orderId);

    if (!delivered) {
        return ConsignmentResult.UNDELIVERED;
    }

    Workflow.await(Duration.ofMinutes(1), () -> customerConfirmed);
    return ConsignmentResult.DELIVERED;
}
```

It waits indefinitely for a `shipmentDispatched` signal (the fulfilment system pushes it when the parcel leaves the warehouse), sleeps 2 minutes (a durable timer, not a thread sleep), then calls a shipping activity. If shipping reports undelivered, the child returns immediately with `UNDELIVERED` - no customer-confirm step, because there's nothing to confirm.

The return type is a plain enum, defined in `common/src/main/java/id/adiputera/common/dto/ConsignmentResult.java`:

```java
public enum ConsignmentResult {
    DELIVERED,
    UNDELIVERED
}
```

Nothing exotic. The parent just switches on it.

## The Compensation Branch

Back in the parent, when the child returns `UNDELIVERED`, two activities run in order:

```java
payment.refundPayment(orderId);
email.sendOrderCancelledNotification(orderId);
```

Each is a stub call that routes to the relevant service's worker. Each has its own retry policy baked into the stub options. If `refundPayment` fails on attempt 1, Temporal retries. If `sendOrderCancelledNotification` fails after `refundPayment` succeeded, the refund is not repeated - the parent's position in history is already past the refund step. This is the Temporal equivalent of a saga's "already-compensated" bit, except you don't have to maintain it.

If either activity exhausts its retries, the workflow itself fails - and that fact is visible in `GET /workflows/order-{orderId}` on cms-service. You can investigate, fix the underlying issue, and re-trigger the compensation manually.

## Why "Parent Blocks on Child" and Not "Fire and Forget"

Temporal's child workflow stub also supports `Async.function(consignment::startConsignment, orderId)`, which starts the child and returns a `Promise`. The sample deliberately doesn't use that. Here's why:

- **Compensation needs the result.** The parent has to know whether to refund - it can't refund speculatively and reconcile later.
- **Compensation needs the original business context.** The parent still holds `orderId`, the original `PlaceOrderRequest`, the payment status, and the activity stubs pointed at the right task queues. Moving refund into `consignment-service` would require shipping that context across the wire.
- **The parent's history becomes a single timeline.** One `workflowId=order-1001` has "order placed → payment received → consignment started → consignment completed with UNDELIVERED → refund → cancellation email → completed". If the child ran detached, you'd have two histories to stitch together in the UI.

The trade-off is that the parent ties up a workflow execution slot until the child returns. For a 1-hour shipment that's fine. For a 30-day fulfilment process it might not be - at that scale `continueAsNew` on the parent, or a signal-back-to-parent pattern, might fit better.

## What the Combined History Shows

After an `UNDELIVERED` run for `orderId=2009`, cms-service's detail endpoint shows both workflows as `COMPLETED` and the parent's pending-children field is empty:

```json
GET /workflows/order-2009
{
  "workflowId": "order-2009",
  "status": "COMPLETED",
  "activities": [
    { "type": "SendOrderPlacedNotification",      "state": "completed" },
    { "type": "SendPaymentCompletedNotification", "state": "completed" },
    { "type": "RefundPayment",                    "state": "completed" },
    { "type": "SendOrderCancelledNotification",   "state": "completed" }
  ],
  "pendingChildren": []
}

GET /workflows/consignment-2009
{
  "workflowId": "consignment-2009",
  "status": "COMPLETED",
  "result": ["\"UNDELIVERED\""],
  "activities": [
    { "type": "CheckShipping", "state": "completed" }
  ]
}
```

Two rows in the workflow list, two terminal histories, one linked flow. The compensation activities sit in the *parent's* history, right where the business logic put them.

## Conclusion

The saga pattern doesn't require a saga coordinator library. A Temporal parent workflow with a blocking child call - plus a return type that tells the parent what happened - expresses the same idea with less ceremony:

- The **happy path** is a linear sequence of activity calls in one method.
- The **compensation path** is an `if` statement after the child returns.
- **Retries** and **idempotency** are handled by Temporal's activity retry options plus deterministic workflow ids.
- **Audit** is the workflow history, exposed via the Temporal UI or an endpoint like cms-service's `GET /workflows/{id}`.

The full sample is on [GitHub](https://github.com/adiputera/spring-boot-temporal). Have a look at `OrderWorkflowImpl.runConsignment` and `ConsignmentWorkflowImpl` together - it's under 100 lines of workflow code and it models the whole place-order-through-delivery saga.
