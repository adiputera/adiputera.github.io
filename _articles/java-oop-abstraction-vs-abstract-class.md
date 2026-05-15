---
layout: article
title: "Abstraction Is Not an Abstract Class"
description: "Why the abstraction principle in OOP is not the same as an abstract class, and how we use abstraction at every layer without realizing it."
date: 2026-04-02
date_modified: 2026-04-02
tags: [java, oop, software-design]
keywords: "Java, OOP, Abstraction, Abstract Class, Interface, Software Engineering, Architecture"
permalink: /articles/java-oop-abstraction-vs-abstract-class
breadcrumb: "Articles"
breadcrumb_short: "Abstraction vs Abstract Class"
snippet: "Why the abstraction principle in OOP is not the same as an abstract class, and how we use abstraction at every layer without realizing it."
snippet_id: "Mengapa prinsip abstraksi dalam OOP tidak sama dengan abstract class, dan bagaimana kita menggunakan abstraksi di setiap level tanpa menyadarinya."
canonical_url: ""
canonical_source: ""
published: true
---

## The Background

Abstraction is not an abstract class. They are not the same thing.

I see this confusion a lot, even from senior engineers. Someone says "we need abstraction here" and what they actually mean is "let's add an interface." Those are two different things.

Abstraction is a principle - hide complexity, expose only what matters. An abstract class is just one tool to do that. Confusing the two leads to bad design decisions.

## Abstraction is Everywhere

You already use abstraction all the time. It exists at every layer, long before you write the `abstract` keyword.

- Using Spring Boot or Quarkus? That's abstraction. You don't manage the embedded Tomcat server or connection pool lifecycle yourself.
- Writing `@RestController` or `@RequestMapping`? Abstraction over raw HTTP servlets and header parsing.
- Pulling in a library via Maven or Gradle? Abstraction.
- Running Docker or deploying to Kubernetes? Abstraction over Linux namespaces and cgroups.
- Running on AWS, Azure, or GCP? Abstraction over physical data centers and networking hardware.

We build on top of layers we don't fully manage. We know the input and the output, but we don't need to understand all the complexity behind it. That's the point of abstraction.

## You Already Do It

You've probably built abstractions yourself without thinking about it that way.

When you see a big block of messy code and decide to extract a method, give it a clear name, and pass in a few parameters - that's an abstraction. The caller doesn't care how the data is processed, just that calling `processOrder()` does what it says.

Abstract classes and interfaces come in when you want to formalize that contract:

```java
public interface PaymentGateway {
    PaymentResult charge(Order order);
}

public class DefaultPaymentGateway implements PaymentGateway {
    @Override
    public PaymentResult charge(Order order) {
        // Complex business logic
    }
}
```

The caller only sees `PaymentGateway.charge()`. The details stay behind the interface.

## But the Tool Alone Isn't Enough

Using an abstract class or interface doesn't automatically mean you're doing abstraction well.

If your interface forces the caller to pass in a database connection object, or if it throws `SQLException` instead of a domain exception, the caller is now tied to your implementation details. You used the tool but missed the point.

Abstract classes and interfaces are tools. Using them poorly doesn't give you abstraction, it just adds an extra layer of indirection.

## Conclusion

Abstraction exists at every level. It's how we manage complexity in large systems.

When designing a module or reviewing code, don't just check if there's an interface or abstract class. Check if the boundary actually hides the complexity it should. Does the caller need to know what's behind it? If not, you've done it right.
