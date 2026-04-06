---
layout: article
title: "How to install additional plugins to Backoffice's WYSIWYG editor"
description: "Technical guide on installing custom CKEditor plugins into SAP Commerce Backoffice."
keywords: "SAP Commerce, Backoffice, WYSIWYG, CKEditor Plugins, Java Engineer, Hybris Development"
date: 2023-11-29
date_modified: 2023-11-29
canonical_url: "https://community.sap.com/t5/crm-and-cx-blog-posts-by-members/how-to-install-additional-plugins-to-backoffice-s-wysiwyg-editor/ba-p/13581050"
canonical_source: "SAP Community"
breadcrumb: "Articles"
breadcrumb_short: "Install Backoffice Plugins"
permalink: /articles/install-plugins-backoffice
snippet: "A technical exploration on advanced CKEditor customization within the SAP Commerce framework, detailing how to inject custom JavaScript plugins into the Backoffice environment."
snippet_id: "Eksplorasi teknis mengenai penyesuaian lanjutan CKEditor dalam kerangka kerja SAP Commerce, merinci cara menyuntikkan plugin JavaScript kustom ke dalam lingkungan Backoffice."
---

## Intro

SAP Commerce's Backoffice uses **ZKCKEditor** (ZKCKeditor is a wrapper of CKEditor for the ZK framework) as a WYSIWYG editor. Out of the box, CKEditor supports various additional plugins other than those that are already installed.

In this blog post, I will guide you on how to install new plugins to Backoffice's WYSIWYG editor, I will guide you using the **SAP Commerce 2205.18** version (with **ZKCKeditor 4.21.0.0**). If you use a different SAP Commerce version, the ZKCKEditor version might be different, but the overall steps should be the same.

Also, I will be using the Code Snippet plugin by CKSource as the example plugin that I will install in this blog post. If you have your own plugins, the overall steps should be the same.

## Prerequisites:

You need basic knowledge of SAP Commerce and its extensions.

## The Steps

1. Find out the ZKCKEditor's jar file (it's named **ckez-xyz.jar**, xyz is the version). For SAP Commerce 2205, it should be on **bin/modules/backoffice-framework/backoffice/web/webroot/WEB-INF/lib/**

2. Copy the jar file to another empty folder, for example in **Document/ck-editor,** I will mention this folder as the **"extracted jar folder"**

3. Open the folder in the terminal (command prompt or Windows terminal if you're using Windows)

4. Execute this (change 4-21.0.0 with any version you use):

   ```
   jar xvf ckez-4.21.0.0.jar
   ```

5. The jar file will be extracted, remove the jar file.

   ![Extracted jar content](/images/articles/install-plugins-backoffice/Cuplikan-layar-dari-2023-11-29-10-46-13.png)

6. Download plugins if you haven't, you can find many plugins from the [CKEditor's add-ons website](https://ckeditor.com/cke4/addons/plugins/all).

7. For example, I will use the [Code Snippet](https://ckeditor.com/cke4/addon/codesnippet) plugin, download the plugins and all its dependencies (if any)

8. Extract the plugin's zip.

   ![Extracted plugin zip](/images/articles/install-plugins-backoffice/Cuplikan-layar-dari-2023-11-29-16-13-10.png)

9. Copy the plugin folder (the folder that contains the plugin.js file).

   ![Plugin folder](/images/articles/install-plugins-backoffice/Cuplikan-layar-dari-2023-11-29-16-15-13.png)

   For my example, the folder that I should copy is the **codesnippet**

10. Paste it in **${extraced jar folder}/web/js/ckez/ext/CKeditor/plugins**

    ![Pasted plugin in CKeditor/plugins](/images/articles/install-plugins-backoffice/Cuplikan-layar-dari-2023-11-29-16-31-33.png)

11. Go to the **"extracted jar folder"** in steps 3-5, and if you haven't, remove the jar file, so the folder will only contain the extracted content of the jar file.

    ![Extracted jar folder ready for repackaging](/images/articles/install-plugins-backoffice/Cuplikan-layar-dari-2023-11-29-12-59-22.png)

12. Execute this (change 4-21.0.0 with any version you use):

    ```
    jar cf ckez-4.21.0.0.jar *
    ```

13. The new jar file will be created.

14. Put the new jar back to where you found it in step 1, and replace the original jar. You can use **ant customize** for this.

15. Create a new file, named **customckeditorconfig.js** in **{backofficeextension}/backoffice/resources/cng/customckeditorconfig.js**

    ```javascript
    CKEDITOR.editorConfig = function(config) {
        // to activate the plugin
        config.extraPlugins = 'codesnippet';
    };
    ```

16. Add this line inside **{backofficeextension}/project.properties** so CKEditor can read the config:

    ```
    backoffice.wysiwyg.config.uri=/cng/customckeditorconfig.js
    ```

17. Build the application by executing **ant all**

18. Start the server, open the backoffice, and open any WYSIWYG editor, there will be the code snippet button

    ![Code snippet button in editor](/images/articles/install-plugins-backoffice/Cuplikan-layar-dari-2023-11-29-16-47-26.png)

19. Try it by clicking the insert code snippet button, and adds some code

    ![Adding code snippet](/images/articles/install-plugins-backoffice/Cuplikan-layar-dari-2023-11-29-16-54-02.png)

20. The code snippet will be added to the body

    ![Code snippet added](/images/articles/install-plugins-backoffice/Cuplikan-layar-dari-2023-11-29-16-56-51.png)

21. Done.

## Conclusions

We've covered all the steps necessary to install additional plugins to Backoffice's WYSIWYG editor. In this tutorial, I'm using Pop!_OS, but the command should be working for other OSs too although I only tested it in Pop!_OS and Windows only.

Please let me know in the comment if you have any feedback or any questions. You might also check other blogs about [SAP Commerce](https://blogs.sap.com/tags/67837800100800007216/) or [SAP Commerce Cloud](https://blogs.sap.com/tags/73555000100800001224/).

Or you might want to check answers.sap.com on [SAP Commerce](https://answers.sap.com/tags/67837800100800007216) or [SAP Commerce Cloud](https://answers.sap.com/tags/73555000100800001224) topic.
