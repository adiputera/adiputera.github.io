---
layout: article
title: "How to Implement Lazy Loading of CMS Components in SAP Commerce Accelerator Storefront"
description: "Step-by-step guide on implementing lazy loading of CMS components in SAP Commerce (Hybris) Accelerator Storefront using JSP and JavaScript to improve page load performance."
date: 2026-04-09
date_modified: 2026-04-09
permalink: /articles/component-lazy-load-sap-commerce
breadcrumb: "Articles"
breadcrumb_short: "Component Lazy Load"
snippet: "A practical guide on implementing CMS component lazy loading in SAP Commerce Accelerator Storefront to reduce initial page load time by deferring off-screen components."
snippet_id: "Panduan praktis mengimplementasikan lazy loading komponen CMS pada SAP Commerce Accelerator Storefront untuk mengurangi waktu muat halaman dengan menunda komponen di luar viewport."
canonical_url: ""
canonical_source: ""
published: false
---

## The Background

SAP Commerce Accelerator Storefront is a powerful, component-based front end that makes it easy for business users to change content without needing a deployment. But because of its rich content nature, rendering all components on every page load can take time — and on a website, every millisecond counts.

The idea is simple: **components outside the viewport don't need to be loaded immediately**. By deferring their rendering until the user scrolls to them, we can significantly reduce the initial page load time.

## How It Works

At the first page load, components outside the viewport will not be rendered. Instead, we place a **dummy element** in place of each deferred component. When the dummy element enters the viewport (the user scrolls down), the browser makes an **Ajax call** to fetch the component's HTML and replaces the dummy element with the actual content.

This approach:
- Reduces initial page load time by only rendering visible components
- Loads off-screen components on demand as the user scrolls
- Works with the existing JSP-based Accelerator Storefront (no Angular required)

## Prerequisites

1. Basic knowledge of SAP Commerce (Hybris) Accelerator Storefront
2. Understanding of JSP tag files and CMS component rendering
3. Basic knowledge of JavaScript

## Implementation

1. Create 2 JSP files, **cmscontentslot.jsp** and **cmscomponent.jsp**. **Cmscontentslot.jsp** will be used for returning all components in a content slot, while **cmscomponent.jsp** will be used for returning single component by its UID.
    - **cmscontentslot.jsp**
    ```HTML
    <%@ page trimDirectiveWhitespaces="true"%>
    <%@ taglib prefix="cms" uri="http://hybris.com/tld/cmstags"%>
    <%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>

    <cms:pageSlot position="${slotPosition}" var="feature"
                element="${fn:escapeXml(slotElement)}"
                class="${fn:escapeXml(slotClass)}">
        <cms:component component="${feature}"
                    element="${fn:escapeXml(componentElement)}"
                    class="${fn:escapeXml(componentClass)}"/>
    </cms:pageSlot>
    ```
    - **cmscomponent.jsp**
    ```HTML
    <%@ page trimDirectiveWhitespaces="true"%>
    <%@ taglib prefix="cms" uri="http://hybris.com/tld/cmstags"%>
    <%@ taglib prefix="fn" uri="http://java.sun.com/jsp/jstl/functions" %>

    <cms:component uid="${componentUid}"
                element="${fn:escapeXml(componentElement)}"
                class="${fn:escapeXml(componentClass)}"/>
    ```

2. Create the controller.
    ```java
    package id.adiputera.training.storefront.controllers.cms;

    import de.hybris.platform.acceleratorstorefrontcommons.controllers.pages.AbstractPageController;
    import de.hybris.platform.cms2.exceptions.CMSItemNotFoundException;
    import de.hybris.platform.cms2.model.pages.AbstractPageModel;
    import org.apache.commons.lang3.StringUtils;
    import org.springframework.stereotype.Controller;
    import org.springframework.ui.Model;
    import org.springframework.web.bind.annotation.GetMapping;
    import org.springframework.web.bind.annotation.RequestParam;

    import javax.servlet.http.HttpServletRequest;
    import javax.servlet.http.HttpServletResponse;
    import java.util.Map;

    /**
     * The class ComponentController
     *
     * @author Yusuf F. Adiputera
     */
    @Controller
    public class ComponentController extends AbstractPageController {

        private static final String FRAGMENTS_CMS_CONTENT_SLOT = "fragments/cms/cmscontentslot"; // NOSONAR
        private static final String FRAGMENTS_CMS_COMPONENT = "fragments/cms/cmscomponent"; // NOSONAR

        @GetMapping(value = "/cms-components")
        public String renderComponentsOfTheSlot(final Model model,
                                                final HttpServletRequest request,
                                                final HttpServletResponse response,
                                                @RequestParam Map<String, String> parameters)
                throws CMSItemNotFoundException
        {
            final String componentUid = parameters.get("componentUid");
            final String componentElement = parameters.get("componentElement");
            final String componentClass = parameters.get("componentClass");

            model.addAttribute("componentElement", componentElement);
            model.addAttribute("componentClass", componentClass);

            if (StringUtils.isNotBlank(componentUid)) {
                model.addAttribute("componentUid", componentUid);
                return FRAGMENTS_CMS_COMPONENT;
            }
            final String pageId = parameters.get("pageId");
            AbstractPageModel pageModel = getContentPageForLabelOrId(pageId);
            if (null != pageModel) {
                storeCmsPageInModel(model, pageModel);
                final String slotPosition = parameters.get("slotPosition");
                final String slotElement = parameters.get("slotElement");
                final String slotClass = parameters.get("slotClass");
                model.addAttribute("slotPosition", slotPosition);
                model.addAttribute("slotElement", slotElement);
                model.addAttribute("slotClass", slotClass);
                return FRAGMENTS_CMS_CONTENT_SLOT;
            }
            throw new CMSItemNotFoundException("Page not found");
        }
    }
    ```
3. Let's test the controller first.

![Result of get components of the slot](/images/articles/component-lazy-load/component-controller-get-slot.png)
*Result of get components of the slot*

As you can see, the controller correctly return the HTML of the slot Section1 from the homepage.

Now let's also test to get component by UID

![Result of get component by UID](/images/articles/component-lazy-load/component-controller-get-by-uid.png)
*Result of get component by UID*

And that works too! Now we can move to the next step.

4. Remove the CMS content slot tag from the layout JSP. Instead of rendering the slot directly, we replace it with a **dummy placeholder element** that holds the slot metadata as data attributes.

    For example, in your page layout JSP (e.g., `landingLayout2Page.jsp`), replace:
    ```HTML
    <cms:pageSlot position="Section1" var="feature" element="div" class="row">
        <cms:component component="${feature}" element="div" class="col-xs-12"/>
    </cms:pageSlot>
    ```

    With a dummy element:
    ```HTML
    <div class="lazy-slot"
         data-slot-position="Section1"
         data-slot-element="div"
         data-slot-class="row"
         data-component-element="div"
         data-component-class="col-xs-12"
         data-page-id="${currentPage.uid}">
        <div class="lazy-loading-placeholder"></div>
    </div>
    ```

    The dummy element is lightweight — it only holds the metadata needed to fetch the actual components later.

5. Create a JavaScript function to fetch the component HTML via Ajax.

    ```javascript
    function fetchSlotComponents(element, functionToExecute) {
        var params = {
            slotPosition: element.getAttribute("data-slot-position"),
            slotElement: element.getAttribute("data-slot-element"),
            slotClass: element.getAttribute("data-slot-class"),
            componentElement: element.getAttribute("data-component-element"),
            componentClass: element.getAttribute("data-component-class"),
            pageId: element.getAttribute("data-page-id")
        };

        var queryString = Object.keys(params)
            .filter(function(key) { return params[key]; })
            .map(function(key) { return key + "=" + encodeURIComponent(params[key]); })
            .join("&");

        fetch("/cms-components?" + queryString)
            .then(function(response) { return response.text(); })
            .then(function(html) {
                element.outerHTML = html;
                if (typeof functionToExecute === "function") {
                    functionToExecute();
                }
            });
    }
    ```

    The `functionToExecute` callback is important — some components rely on JavaScript to initialize after rendering (e.g., carousels, sliders, accordions). Without this callback, those components would render the HTML but remain non-functional.

    For example:
    ```javascript
    fetchSlotComponents(slotElement, function() {
        initCarousel();  // re-initialize carousel after lazy-loaded HTML is injected
    });
    ```

6. Create a function to check if an element is in or above the viewport.

    ```javascript
    function isInOrAboveViewport(element) {
        var rect = element.getBoundingClientRect();
        return rect.top < (window.innerHeight || document.documentElement.clientHeight);
    }
    ```

    This returns `true` if the element is currently visible **or** has already been scrolled past (above the viewport). This ensures components are loaded even if the user scrolls fast.

7. Combine both functions — on scroll, check all lazy slot elements and fetch the ones that enter the viewport.

    ```javascript
    function loadVisibleSlots() {
        var lazySlots = document.querySelectorAll(".lazy-slot");
        lazySlots.forEach(function(slot) {
            if (isInOrAboveViewport(slot)) {
                var callback = slot.getAttribute("data-callback");
                fetchSlotComponents(slot, callback ? window[callback] : null);
            }
        });
    }

    // Throttle helper — limits how often a function can fire
    // During fast scrolling, the scroll event fires on every pixel.
    // Throttle ensures we only check once per interval (e.g., every 200ms).
    // When it does fire, it checks ALL lazy slots at once and triggers
    // fetch for every one that's in the viewport — so multiple components
    // load in parallel, not one by one.
    function throttle(fn, delay) {
        var lastCall = 0;
        return function() {
            var now = Date.now();
            if (now - lastCall >= delay) {
                lastCall = now;
                fn();
            }
        };
    }

    // Load visible slots on page load and on scroll (throttled)
    document.addEventListener("DOMContentLoaded", loadVisibleSlots);
    window.addEventListener("scroll", throttle(loadVisibleSlots, 200));
    ```

8. Test the result. Open your browser's DevTools Network tab and scroll down the page. You should see Ajax calls being made to `/cms-components` as each lazy slot enters the viewport.

    <!-- TODO: Add screenshot of network tab showing lazy load requests -->

9. Why the dummy element is important: without it, the page would have **no height** where the components should be, causing a layout shift (CLS) when the component loads. The placeholder element reserves space and can show a loading indicator to the user.

    You can style the placeholder to indicate loading:
    ```css
    .lazy-loading-placeholder {
        min-height: 200px;
        background: #f4f4f4;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    ```

10. Test again with the placeholder styling. The page should now:
    - Load fast (only above-the-fold components rendered server-side)
    - Show placeholder blocks for off-screen components
    - Seamlessly load components as you scroll down

    <!-- TODO: Add before/after screenshot comparison -->

## Result

The initial page load is significantly faster because only the components visible in the viewport are rendered server-side. Off-screen components are loaded on demand via Ajax as the user scrolls.

<!-- TODO: Add performance metrics (page load time before vs after) -->

## Credits

This implementation is inspired by [Rauf Aliev's article on Angular2 and Hybris integration](https://hybrismart.com/2016/09/03/angularjs-v-2-and-hybris/), adapted for the JSP-based Accelerator Storefront.

