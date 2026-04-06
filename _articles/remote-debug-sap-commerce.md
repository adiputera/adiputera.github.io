---
layout: article
title: "How to Remote Debug SAP Commerce (on premise version) on IntelliJ IDEA and Eclipse"
description: "A comprehensive guide on setting up remote debugging for SAP Commerce using IntelliJ IDEA and Eclipse."
keywords: "SAP Commerce, Remote Debugging, IntelliJ IDEA, Eclipse, Hybris Debugging, Java Backend Engineer"
date: 2022-09-15
date_modified: 2022-09-15
canonical_url: "https://community.sap.com/t5/crm-and-cx-blog-posts-by-members/how-to-remote-debug-sap-commerce-on-premise-version-on-intellij-idea-and/ba-p/13542943"
canonical_source: "SAP Community"
breadcrumb: "Articles"
breadcrumb_short: "Remote Debug SAP Commerce"
permalink: /articles/remote-debug-sap-commerce
snippet: "A deep-dive tutorial explaining how developers can configure and attach remote debuggers within IntelliJ IDEA and Eclipse to troubleshoot complex SAP Commerce (On-Premise) server issues."
snippet_id: "Tutorial mendalam yang menjelaskan bagaimana developer dapat mengonfigurasi dan menyambungkan debugger jarak jauh di IntelliJ IDEA dan Eclipse untuk memecahkan masalah kompleks pada server SAP Commerce (On-Premise)."
---

## The background:

In my experience, sometimes bugs only occurs on some environment, and I can't reproduce the issue in local environment, the only way to see what went wrong is to do remote debug the application server.

## The Goal:

This blog will guide you on how to do remote debugging on SAP Commerce instance. I will cover how to do remote debugging in IntelliJ IDEA as well in eclipse.

Remote debugging let you inspect running code, what is the value of variables in code, and determine what is the result of some method.

## Prerequisites:

1. Basic knowledge in SAP Commerce
2. Basic knowledge in application debugging
3. Have a direct access to application server on port 8000 (or other port if you didn't want to use port 8000), please consult to your infra team for server access.
4. Have an SSH access to server, or pipeline to start the server in debug mode

## The first step

These steps will cover how to setup application server so it can be debugged remotely.

1. Add following property to local.properties on server:

   ```
   tomcat.debugjavaoptions=-Djava.locale.providers=COMPAT,CLDR -Xdebug -Xnoagent -Xrunjdwp:transport=dt_socket,server=y,address=*:8000,suspend=n
   ```

   To add the config, you can either SSH to the server and add it manually, or re-deploy with the above config added. You need to do build (**ant all**) after you add above config.

   If you want to change the debug port, you can change 8000 to any port you like.

2. SSH to application server, and start the server in debug mode by executing **./hybrisserver.sh debug** or **hybrisserver.bat debug**

3. Make sure you have the same code as the server, do build (**ant all**) in your local environment

4. If your environment is running on clustering environment, I recommend stopping all other node apart from the one you are debugging. Or if it's not possible to stop all other node, you can isolate application server that we are using from load balancer, so no request will be coming to that server, then to reproduce the issue, you can access storefront directly using app server's IP address.

## How to debug on IntelliJ IDEA?

These steps will cover on how to connect IntelliJ IDEA to remote server and do debugging

1. Edit configuration of remote debug, as shown in the picture below:

   ![IntelliJ Remote JVM Debug menu](/images/articles/remote-debug-sap-commerce/intellij-debug-config-menu.png)

2. In debug configuration window, change Host to IP address of the server, and port if you change the port number in the first step above.

   ![IntelliJ Remote Debug configuration](/images/articles/remote-debug-sap-commerce/intellij-debug-config-window-1.png)

3. Start debugging, add some breakpoints, just like debugging your local machine.

## How to debug on Eclipse?

These steps will cover on how to connect Eclipse to remote server and do debugging

1. On eclipse, click on menu **Run** -> **Debug configurations...**

2. Double click on **Remote Java Application** to create new debug configuration

3. Give name whatever you like, here I give name hybris. On the Connection Properties, put server's IP Address to Host

   ![Eclipse Debug configurations window](/images/articles/remote-debug-sap-commerce/Eclipse-debug-config-window.png)

4. On project section, click on browse, and select platform

   ![Eclipse source lookup configuration](/images/articles/remote-debug-sap-commerce/Cuplikan-layar-dari-2022-08-11-14-04-11.png)

5. On source tab, click add -> choose file system directories -> select you bin folder

   ![Eclipse add folder to source lookup](/images/articles/remote-debug-sap-commerce/Eclipse-add-folder-config.png)

6. Back in Debug Configuration window, click Apply, then click Debug to start debugging.

7. Start debugging, add some breakpoints, just like debugging your local machine.

## Conclusions

Remote debugging application server is pretty easy, the steps are almost identical to debugging local environment, with the only difference is we need to have direct access to application server and be able to start it in debug mode, other than that, the steps are the same.

Please let me know in the comment if you have any feedback, or any question. You might also check other blogs about [SAP Commerce.](https://blogs.sap.com/tags/67837800100800007216/)

Or you might want to check answers.sap.com on [SAP Commerce](https://answers.sap.com/tags/67837800100800007216) or [SAP Commerce Cloud](https://answers.sap.com/tags/73555000100800001224) topic.
