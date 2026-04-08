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

4. ini untuk hapus tag cms content slot dari layout jsp

5. ini untuk bikin function call component

6. ini untuk bikin function is element in or above view port

7. ini untuk bikin function gabungin 5 dan 6.

8. ini untuk hasil test

9. ini untuk ngasih dummy element di layout, kenapa perlu

10. test lagi

## Result

<!-- TODO: Add before/after comparison, performance metrics -->

## Credits

This implementation is inspired by [Rauf Aliev's article on Angular2 and Hybris integration](https://hybrismart.com/2016/09/03/angularjs-v-2-and-hybris/), adapted for the JSP-based Accelerator Storefront.

