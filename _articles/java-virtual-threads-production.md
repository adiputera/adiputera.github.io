---
layout: article
title: "Java Virtual Threads (Loom): What I Learned Putting Them in Production"
description: "A practical look at Java virtual threads from JDK 21 onwards, what changes when you adopt them in a real service, and the pitfalls that still trip people up."
date: 2026-04-28
date_modified: 2026-04-28
keywords: "Java, JDK 21, Project Loom, Virtual Threads, Concurrency, Spring Boot, Carrier Thread, ScopedValue"
permalink: /articles/java-virtual-threads-production
breadcrumb: "Articles"
breadcrumb_short: "Virtual Threads"
snippet: "A practical look at Java virtual threads in production - what they actually fix, the small refactor that turned a 200-thread fixed pool into something much cheaper, and the pitfalls (pinning, ThreadLocal cost, pooling them by mistake) that still trip people up."
snippet_id: "Tinjauan praktis penggunaan Virtual Threads di produksi - apa yang sebenarnya diperbaiki, refactor kecil yang menggantikan thread pool 200 thread dengan sesuatu yang jauh lebih murah, serta pitfalls (pinning, biaya ThreadLocal, salah pakai pooling) yang masih sering menjebak."
canonical_url: ""
canonical_source: ""
published: false
---

## The Background

Virtual threads landed in Java 21 as the final delivery of Project Loom, and they have been quietly reshaping how I write server-side Java ever since. The pitch is simple: threads that are cheap enough to use one per request, even when the request blocks on I/O. No more reactive rewrites just to hold a thousand connections at once, no more carefully tuned thread pools, no more `CompletableFuture` chains threaded through your business logic.

I've now had virtual threads running in production for long enough to have opinions. They are not magic. They don't make a slow service fast. They don't reduce CPU usage. What they do is collapse the cost of "waiting on something" — a database call, an HTTP fetch, a Kafka publish — from a precious platform thread down to a bookkeeping entry on the JVM heap. For a service that spends most of its wall-clock time waiting for other services, that is a big deal.

This article covers what virtual threads actually are, the refactor I did on a real Spring Boot service to adopt them, and the pitfalls I have run into so you can dodge them.

## What Changes (and What Doesn't)

The `Thread` API doesn't change. A virtual thread is still a `java.lang.Thread`. It still has `start()`, `join()`, `sleep()`, `interrupt()`, and an ID. Anything that took a `Thread` or a `Runnable` before still works.

What changes is the factory. Instead of `new Thread(runnable)` you ask for a virtual one:

```java
Thread.startVirtualThread(() -> doWork());

Thread t = Thread.ofVirtual().name("worker-1").unstarted(() -> doWork());
t.start();
```

Or, much more commonly, you ask for an executor that hands out one virtual thread per task:

```java
try (var executor = Executors.newVirtualThreadPerTaskExecutor()) {
    List<Future<String>> results = urls.stream()
        .map(url -> executor.submit(() -> http.get(url)))
        .toList();

    for (var f : results) {
        System.out.println(f.get());
    }
}
```

Underneath, the JVM mounts each virtual thread onto a small pool of platform threads called carrier threads. When the virtual thread blocks on a `Socket`, a `Selector`, `Thread.sleep`, a `synchronized` lock, or any other JDK-level blocking call that has been Loom-aware-ified, the JVM unmounts it from its carrier and puts the carrier back to work on a different virtual thread. The blocked virtual thread sits on the heap waiting for its event. When the event arrives, the scheduler picks it up and re-mounts it on whichever carrier is free.

That is the entire trick. The cost of "waiting" stops being a thread (megabytes of stack, kernel scheduling overhead) and becomes an object on the heap (kilobytes, scheduler bookkeeping). You can have a million of them. You cannot have a million platform threads.

What does NOT change is your CPU budget. If your service is genuinely CPU-bound, virtual threads do nothing for you. The carriers are still platform threads, and they still execute code on the same set of cores you had before.

## Refactoring a Service

The service I'll talk about here is a thin orchestration layer. A request comes in, the service fans out to four downstream services, aggregates the responses, and returns. Each downstream call typically takes 30–80 ms, mostly waiting on the network.

The original implementation used a fixed thread pool sized to handle the expected concurrency:

```java
@Service
class OrchestrationService {

    private final ExecutorService executor =
        Executors.newFixedThreadPool(200);

    public AggregateResponse handle(Request req) throws Exception {
        Future<A> a = executor.submit(() -> downstreamA.call(req));
        Future<B> b = executor.submit(() -> downstreamB.call(req));
        Future<C> c = executor.submit(() -> downstreamC.call(req));
        Future<D> d = executor.submit(() -> downstreamD.call(req));

        return new AggregateResponse(a.get(), b.get(), c.get(), d.get());
    }
}
```

200 threads, hand-tuned, with the usual problems. Burst traffic above the pool size queued up. Increasing the pool meant more memory and more context switches. We had Hystrix-style timeouts on each downstream call, which meant any thread that hung on a slow downstream was unavailable to anyone else for the full timeout window.

The virtual-thread version is a one-line change to the executor:

```java
@Service
class OrchestrationService {

    private final ExecutorService executor =
        Executors.newVirtualThreadPerTaskExecutor();

    public AggregateResponse handle(Request req) throws Exception {
        Future<A> a = executor.submit(() -> downstreamA.call(req));
        Future<B> b = executor.submit(() -> downstreamB.call(req));
        Future<C> c = executor.submit(() -> downstreamC.call(req));
        Future<D> d = executor.submit(() -> downstreamD.call(req));

        return new AggregateResponse(a.get(), b.get(), c.get(), d.get());
    }
}
```

The behaviour change after the rollout was exactly what I expected, no more and no less. P50 and P99 latencies stayed the same — virtual threads don't make individual calls faster. The thread count visible in JFR dropped from a steady 200+ to roughly the number of carriers (one per core, default). The queuing problem under burst traffic disappeared because there is no queue any more — every incoming task gets its own virtual thread immediately.

If you're on Spring Boot 3.2 or later, you can also flip the embedded Tomcat to virtual threads with a single property and get the same benefit for the request-handling threads themselves:

```properties
spring.threads.virtual.enabled=true
```

That alone is worth the upgrade for any service that spends most of its time waiting.

## Pitfalls

### `synchronized` pinning

Pre-JDK 24, when a virtual thread entered a `synchronized` block and then blocked inside it, the JVM could not unmount the virtual thread from its carrier. The carrier was pinned for the duration of the block. Hot paths that synchronised around a network call could exhaust your carriers and produce mysterious slowdowns.

JDK 24 fixed this — `synchronized` no longer pins. If you are on JDK 21 to 23, the workaround is to switch the hot synchronised blocks to `ReentrantLock`, which always releases the carrier on block. You can detect pinning by running with `-Djdk.tracePinnedThreads=full` and watching for stack traces in the logs.

### `ThreadLocal` is suddenly expensive

`ThreadLocal` was always cheap because there were a few hundred threads at most. With virtual threads you might have a million, each carrying its own `ThreadLocal` map. That is a lot of heap.

For new code, prefer `ScopedValue` (final in JDK 25, preview before that). It is structured, scoped to a `try`-style block, and inherited cleanly across threads spawned within that scope. For library code that already uses `ThreadLocal` (logging MDC is a common one), think about whether the value is set per-request or per-application — per-application values should not live in a `ThreadLocal` at all.

### Don't pool virtual threads

This trips up everyone who instinctively reaches for a thread pool. Virtual threads are the pool. Wrapping them in `Executors.newFixedThreadPool` to "limit concurrency" defeats the entire point — you are now back to a fixed number of threads, and the virtual threads are just expensive wrappers around them.

If you genuinely need a concurrency limit (to avoid hammering a downstream service), use a `Semaphore` around the operation, not a bounded executor. The virtual threads can all wait on the semaphore cheaply.

```java
private final Semaphore downstreamPermits = new Semaphore(50);

public Result fetch(String id) throws InterruptedException {
    downstreamPermits.acquire();
    try {
        return downstream.call(id);
    } finally {
        downstreamPermits.release();
    }
}
```

### Native and FFI calls still pin

If your code calls into JNI or Foreign Function & Memory and the native side blocks, the JVM has no way to unmount the virtual thread. The carrier is pinned until the native call returns. This is rare in practice — most things are pure Java — but if your service uses a native library for compression, image processing, or hardware access, profile it before assuming virtual threads will help.

## When NOT to Use Them

Virtual threads are the wrong tool for:

- **CPU-bound work.** A virtual thread doing tight-loop computation just hogs its carrier without ever yielding. Use a dedicated platform-thread pool sized to your core count.
- **Hot paths with strict timing.** The scheduler will yield your virtual thread when it blocks. If you absolutely need the same thread to keep running without interruption (a real-time-ish workload), platform threads still give you more predictability.
- **Code that depends on thread identity.** Some legacy frameworks key behaviour off the thread object — connection pools, transactional contexts, custom security contexts. If you have a million threads, none of them being long-lived, those caches and context lookups can misbehave. Test before assuming.

## Conclusion

Virtual threads aren't a performance magic trick. They are a way to write straightforward, blocking-style code without paying the platform-thread cost for every concurrent operation. For an I/O-heavy service — orchestration layers, BFFs, anything that spends its life waiting on other services — they are a clear win and the migration is usually trivial.

For a CPU-bound service, or a service that has already paid the complexity tax of going reactive, the case is weaker. There is no harm in trying them, but expect the gain to be modest.

The pattern I now reach for by default is: virtual threads everywhere, `ReentrantLock` instead of `synchronized` on hot paths, `ScopedValue` instead of new `ThreadLocal`s, and a `Semaphore` whenever I need to bound concurrency. That set of habits has held up well across a few different services so far.

I hope this helps. Let me know in the comments if you have any questions or if there's a specific virtual-thread scenario you'd like me to cover in more detail.
