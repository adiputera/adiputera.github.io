---
layout: article
title: "Signal or Timeout: Handling Payment Confirmation in a Temporal Workflow"
description: "How to use Temporal's Workflow.await with a duration to wait for a signal with a fallback activity - durable, replay-safe, and fully visible in the workflow history."
keywords: "Temporal, Spring Boot, Workflow.await, Signal, Timeout, Durable Timer, Java SDK"
date: 2026-04-24
date_modified: 2026-04-24
permalink: /articles/temporal-workflow-await-signal-or-timeout
breadcrumb: "Articles"
breadcrumb_short: "Temporal Signal or Timeout"
snippet: "A focused look at Temporal's Workflow.await(Duration, Supplier) - the cleanest way I know to wait for an external signal with a bounded timeout, and fall back to an activity if it never arrives."
snippet_id: "Penjelasan mendetail mengenai Workflow.await(Duration, Supplier) di Temporal - cara terbersih untuk menunggu signal eksternal dengan batas waktu, lalu jatuh ke aktivitas cadangan jika signal tak pernah datang."
published: false
---

> **Disclaimer:** The [spring-temporal](https://github.com/adiputera/spring-temporal) project referenced in this article is a simplified, dummy sample. It is designed specifically to demonstrate the workflow and orchestration concepts, not to serve as production-ready business logic.

## The Problem

Once an order is placed, the workflow needs to wait for the customer to pay. That wait has three possible outcomes:

1. The customer pays within the grace period → continue to fulfilment.
2. The grace period expires but a reconciliation check says the customer actually paid → continue to fulfilment.
3. The grace period expires and the reconciliation check says they didn't → cancel the order.

A naïve implementation polls a database every few seconds inside the workflow. That's wrong for two reasons: polling wastes Temporal tasks, and Temporal workflows are supposed to be **deterministic and replay-safe** - every non-deterministic operation (reading the current time, generating a random number, calling a database) has to go through the SDK so it can be recorded in the workflow history.

Temporal's answer is `Workflow.await(Duration timeout, Supplier<Boolean> condition)`. It blocks the workflow until either the condition becomes true (from a signal) or the timeout elapses - both outcomes produce an event in history, and both are replayable.

## The Setup

The signal is defined on the workflow interface (`common/src/main/java/id/adiputera/common/workflow/OrderWorkflow.java`):

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

The implementation holds a plain boolean flag. The signal method flips it, the workflow awaits it (`order-service/src/main/java/id/adiputera/order/workflow/OrderWorkflowImpl.java`):

```java
private boolean paymentReceived = false;

@Override
public void placeOrder(PlaceOrderRequest request) {
    String orderId = request.getOrderId();
    email.sendOrderPlacedNotification(orderId);

    boolean received = Workflow.await(
        Duration.ofMinutes(1),
        () -> paymentReceived);

    // ... branch on `received` ...
}

@Override
public void paymentReceived() {
    this.paymentReceived = true;
}
```

Three things are worth noticing here:

- **The flag is an instance field, not a parameter.** A fresh `OrderWorkflowImpl` is instantiated per workflow execution, so the field is scoped to that one run.
- **No `volatile`, no synchronization.** Temporal serialises signal delivery with workflow execution - the signal handler and the workflow method never run concurrently on the same instance. Writing plain Java code is safe, and trying to add threading primitives is actively wrong (they make the workflow non-deterministic).
- **`Workflow.await` is a no-op in history when the flag is already true.** If the signal arrived before the `await`, the condition is checked immediately and the workflow proceeds without starting a timer.

## The Fallback

If the 1-minute timer fires before the signal, `received` is `false`. The workflow then calls a regular activity to reconcile:

```java
boolean paid;
if (received) {
    email.sendPaymentCompletedNotification(orderId);
    paid = true;
} else {
    Banner.log(log, '!', "TIMEOUT - CHECKING PAYMENT " + orderId);
    paid = payment.checkPayment(orderId);
    if (paid) {
        email.sendPaymentCompletedNotification(orderId);
    } else {
        payment.cancelOrder(orderId);
        email.sendOrderCancelledNotification(orderId);
    }
}
```

`payment.checkPayment` is a stub that routes to the payment-service worker on `payment-tq`. Under the hood it's a plain HTTP or database lookup, wrapped as an activity so Temporal handles retries. In the sample the rule is intentionally trivial - "even order id is paid, odd isn't" - but the shape is what matters: the workflow gets a clean `boolean`, and branches on it.

The retry policy is declared once, at the stub level:

```java
private final PaymentActivities payment = Workflow.newActivityStub(
        PaymentActivities.class,
        ActivityOptions.newBuilder()
                .setTaskQueue(TaskQueues.PAYMENT_TQ)
                .setStartToCloseTimeout(Duration.ofSeconds(30))
                .setRetryOptions(RetryOptions.newBuilder()
                        .setMaximumAttempts(3)
                        .setInitialInterval(Duration.ofSeconds(2))
                        .build())
                .build());
```

If `checkPayment` throws on the first attempt, Temporal retries 2 seconds later, up to three attempts total. The workflow only sees the final outcome - no retry loop in application code.

## What the History Looks Like

Every outcome leaves a clean audit trail in the workflow's history:

**Signal arrives in time:**

```
1  WorkflowExecutionStarted            input={"orderId":"1001"}
5  ActivityTaskScheduled               SendOrderPlacedNotification
...
12 WorkflowExecutionSignaled           name=paymentReceived
...
16 ActivityTaskScheduled               SendPaymentCompletedNotification
```

**Signal never arrives, timer fires:**

```
1  WorkflowExecutionStarted
5  ActivityTaskScheduled               SendOrderPlacedNotification
...
14 TimerStarted                        duration=PT1M
...
16 TimerFired
18 ActivityTaskScheduled               CheckPayment
20 ActivityTaskCompleted               result=false
22 ActivityTaskScheduled               CancelOrder
...
```

In both cases the `TimerStarted` / `TimerFired` vs `WorkflowExecutionSignaled` split is visible in the Temporal UI - you always know exactly which branch a given workflow ran, even years later.

## Gotchas

- **Don't use `Thread.sleep` or `System.currentTimeMillis()`** inside a workflow - they're non-deterministic. Use `Workflow.sleep(Duration)` and `Workflow.currentTimeMillis()` instead. `Workflow.await` uses the durable clock under the hood, so the timer survives worker restarts.
- **Signals can race the workflow start.** If `POST /payment` fires before the workflow's `await` statement runs, Temporal buffers the signal and delivers it as soon as the handler is reachable - the `await` sees `paymentReceived == true` immediately. That's usually what you want. If it isn't, re-check the flag after every step.
- **The signal method must be quick and non-blocking.** It's called on the workflow thread; doing anything slow there stalls the whole workflow. Just flip the flag.
- **`Workflow.await` returns `true` on signal, `false` on timeout.** Branching on the return value is how you tell the two apart - the flag alone doesn't, because by the time you check the flag a late signal may have flipped it after the timer already fired (Temporal still delivers the signal for history completeness).

## Conclusion

`Workflow.await(Duration, () -> flag)` is the pattern I reach for any time a workflow has to wait for an external event with a bounded timeout. It's three lines, it's replay-safe, it produces a clean history, and branching on the return value gives you a single place to decide what to do when the event doesn't come.

The full source for this workflow is in the [spring-temporal](https://github.com/adiputera/spring-temporal) sample - have a look at `OrderWorkflowImpl` for the whole signal-or-timeout branch including the downstream child workflow that kicks off on payment success.
