---
layout: article
title: "Scaling Background Tasks: Running Multiple Kubernetes CronJobs from a Single Spring Boot Image"
description: "A technical case study on optimizing CI/CD and maintenance by consolidating multiple Kubernetes CronJobs into a single Spring Boot application image using argument-based routing."
keywords: "Kubernetes, CronJob, Spring Boot, Docker, CI/CD, microservices, architecture"
date: 2026-06-26
date_modified: 2026-06-26
permalink: /case-studies/kubernetes-cronjob-spring-boot
category: case-study
tags: [architecture, kubernetes, spring-boot, docker]
breadcrumb: "Case Studies"
breadcrumb_url: /case-studies/
breadcrumb_short: "K8s CronJob Architecture"
snippet: "Exploring an efficient architecture for background tasks: deploying a single Spring Boot image across multiple Kubernetes CronJobs using argument-based routing."
snippet_id: "Menjelajahi arsitektur efisien untuk background task: men-deploy satu image Spring Boot ke berbagai Kubernetes CronJob menggunakan argument-based routing."
image: /images/articles/case-study-k8s-cronjob/cover.webp
og_image_width: 1024
og_image_height: 1024
og_image_type: image/webp
published: false
mermaid: true
---

## The Background

When building enterprise systems, you often encounter the need to run various scheduled background tasks: syncing data with third-party APIs, sending daily email summaries, clearing stale database records, or generating nightly reports. 

In a modern Kubernetes ecosystem, the native way to handle these scheduled tasks is by using the `CronJob` resource. However, a common architectural dilemma arises when deciding how to structure the application code for these jobs. 

If you have 10 different scheduled tasks, creating 10 separate Spring Boot projects and 10 separate Docker images quickly becomes a maintenance nightmare. This "one image per job" approach leads to:
*   **Bloated CI/CD Pipelines:** Every minor change requires building, pushing, and deploying multiple independent images.
*   **Code Duplication:** Shared utilities, database repositories, and configuration classes must be duplicated or extracted into a shared library, adding complexity.
*   **Resource Inefficiency:** Managing dozens of repositories for small, single-purpose scripts is overkill.

Rather than fragmenting the codebase, the optimal strategy is to build a single "Cron Runner App"—a consolidated Spring Boot project containing all the cron job logic—and use **argument-based routing** at the Kubernetes level to determine which job executes.

This case study breaks down a Proof of Concept (PoC) demonstrating how to run a single Spring Boot application as multiple distinct Kubernetes CronJobs.

### Why Not Spring's `@Scheduled`?

A common question is: *Why use Kubernetes CronJobs at all? Why not just use Spring Boot's built-in `@Scheduled` annotation and let the application run continuously?*

The problem with in-memory scheduling emerges when you scale your application. If you deploy three replicas of your application to handle web traffic, all three replicas will independently trigger the `@Scheduled` method at the exact same time. This leads to duplicate data processing, race conditions, and potentially corrupted records.

While you can solve this using distributed locking libraries like ShedLock or Quartz (which rely on a shared database table to manage locks), it adds unnecessary complexity to your stack. By delegating the scheduling responsibility entirely to Kubernetes, you guarantee that a job runs exactly once per schedule interval across the cluster, without writing complex locking logic or managing persistent database connections just for scheduling.

## The Architecture: Single Image, Multiple Jobs

To solve the maintenance problem, we can decouple the application logic from the scheduling mechanism. Kubernetes handles the scheduling, while Spring Boot acts merely as an execution router.

```mermaid
graph TD
    K8s[Kubernetes Cluster]
    
    subyaml[CronJob Manifests]
    K8s --> subyaml
    
    SyncJob[CronJob: Sync Data<br/>Schedule: 0 1 * * *]
    EmailJob[CronJob: Send Email<br/>Schedule: 0 8 * * *]
    ReportJob[CronJob: Generate Report<br/>Schedule: 0 0 * * 0]
    
    subyaml --> SyncJob
    subyaml --> EmailJob
    subyaml --> ReportJob
    
    Image[(Docker Image:<br/>k8scron-demo:latest)]
    
    SyncJob -- 'args: ["sync-data"]' --> Image
    EmailJob -- 'args: ["send-email"]' --> Image
    ReportJob -- 'args: ["report"]' --> Image
    
    Image --> SpringBoot{Spring Boot<br/>CommandLineRunner}
    
    SpringBoot -- "sync-data" --> TaskA[Execute Sync Logic]
    SpringBoot -- "send-email" --> TaskB[Execute Email Logic]
    SpringBoot -- "report" --> TaskC[Execute Report Logic]
```

By passing an argument from the Kubernetes manifest to the Docker container, the Spring Boot application knows exactly which subset of its code to execute before gracefully shutting down.

## The Spring Boot Implementation

Because these are transient tasks rather than long-running APIs, the Spring Boot application must be configured as a non-web application. This ensures it boots up quickly, runs the job, and shuts down immediately without starting an embedded Tomcat server.

In `application.properties`:
```properties
spring.main.web-application-type=none
```

### The Command Line Runner

The core of the routing mechanism relies on implementing Spring's `CommandLineRunner`. When the application starts, this interface provides access to the arguments passed via the Docker container's command line.

We use a simple `switch` statement to act as a router:

```java
package id.adiputera.demo.k8scron;

import org.springframework.boot.CommandLineRunner;
import org.springframework.stereotype.Component;

@Component
public class TaskRunner implements CommandLineRunner {

    @Override
    public void run(String... args) throws Exception {
        if (args.length == 0) {
            System.err.println("Error: No job name provided as argument!");
            System.exit(1);
        }

        String jobName = args[0];
        System.out.println("Starting execution for: " + jobName);

        try {
            switch (jobName) {
                case "job-10s":
                    System.out.println("[JOB-10S] Executing business logic for 10s delay job...");
                    // syncDataTask.execute();
                    break;
                case "job-30s":
                    System.out.println("[JOB-30S] Executing business logic for 30s delay job...");
                    // sendEmailTask.execute();
                    break;
                case "job-50s":
                    System.out.println("[JOB-50S] Executing business logic for 50s delay job...");
                    break;
                default:
                    System.err.println("Error: Unknown job '" + jobName + "'!");
                    System.exit(1);
            }

            System.out.println("Job " + jobName + " completed successfully!");
            System.exit(0); // Exit gracefully for K8s Success status

        } catch (Exception e) {
            System.err.println("Job " + jobName + " failed: " + e.getMessage());
            System.exit(1); // Exit with error for K8s Failure status
        }
    }
}
```

Notice the explicit use of `System.exit(0)` and `System.exit(1)`. This is critical. Kubernetes relies on the container's exit code to determine if the Pod succeeded or failed. If an exception is thrown and swallowed without a non-zero exit code, Kubernetes will incorrectly mark a failed job as `Succeeded`.

## The Kubernetes Implementation

On the infrastructure side, we deploy multiple `CronJob` definitions to the cluster. All of them point to the exact same Docker image (`k8scron-demo:latest`), but they override the `args` array to specify their unique identifier.

Here is an example of how the identical image is reused across different scheduled intervals:

```yaml
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cronjob-10s
spec:
  schedule: "* * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cron-runner
            image: k8scron-demo:latest
            imagePullPolicy: IfNotPresent
            command: ["/bin/sh", "-c"]
            args: ["sleep 10 && java -jar /app/app.jar job-10s"]
          restartPolicy: Never
---
apiVersion: batch/v1
kind: CronJob
metadata:
  name: cronjob-30s
spec:
  schedule: "* * * * *"
  jobTemplate:
    spec:
      template:
        spec:
          containers:
          - name: cron-runner
            image: k8scron-demo:latest
            imagePullPolicy: IfNotPresent
            command: ["/bin/sh", "-c"]
            args: ["sleep 30 && java -jar /app/app.jar job-30s"]
          restartPolicy: Never
```

*(Note: The `sleep` command is included here merely to offset the execution times for demonstration purposes, ensuring they don't all execute simultaneously at the top of the minute).*

## The Benefits of This Architecture

Consolidating background jobs into a single image offers several strategic advantages for engineering teams:

1.  **A Single CI/CD Pipeline:** You only need to maintain one Docker build pipeline. Whenever the code for any job is updated, a single image is pushed to the registry. The Kubernetes CronJobs will automatically pull the updated logic on their next scheduled run.
2.  **Maximized Code Reuse:** Because all jobs live in the same repository, they can easily share data models, JPA repositories, third-party API clients, and configuration properties without the overhead of publishing internal Maven dependencies.
3.  **Centralized but Isolated Management:** While the codebase is monolithic, the execution environment remains isolated. In Kubernetes, `cronjob-10s` and `cronjob-30s` appear as completely separate resources. They have independent logs, independent failure metrics, and their schedules can be scaled or modified independently.

## Final Thoughts

Building background tasks doesn't always require complex message brokers like Kafka or RabbitMQ, nor does it require maintaining an army of micro-repositories. By combining the scheduling power of Kubernetes with the argument-parsing capabilities of Spring Boot's `CommandLineRunner`, you can achieve a highly scalable, easy-to-maintain job execution platform using standard, out-of-the-box tools.
