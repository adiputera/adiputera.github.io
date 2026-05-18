const CACHE_NAME = "static-202605181125";
const PRECACHE_URLS = [
    "./images/astra.svg",
    "./src/master.min.css?v=202605181125",
    "./src/index.min.js?v=202605181125"
];

self.addEventListener("install", e => {
    self.skipWaiting();
    e.waitUntil(
        caches.open(CACHE_NAME).then(cache => cache.addAll(PRECACHE_URLS))
    );
});

self.addEventListener("activate", event => {
    event.waitUntil(
        caches.keys()
            .then(keys => Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            ))
            .then(() => self.clients.claim())
    );
});

self.addEventListener("fetch", e => {
    e.respondWith(
        caches.match(e.request).then(response => {
            return response || fetch(e.request);
        })
    );
});

self.addEventListener('push', function (event) {
    console.log("Push event received:", event);

    let data = {
        title: "Hello!",
        body: "You have a new notification!",
        icon: "/images/128.png",
        image: "",
        badge: "/images/badge.png",
        data: {},
        actions: []
    };

    if (event.data) {
        try {
            const json = event.data.json();
            data = { ...data, ...json };
        } catch (e) {
            console.warn("Push data is not valid JSON, using as text:", e);
            data.body = event.data.text();
        }
    }

    event.waitUntil(
        self.registration.showNotification(data.title, {
            body: data.body,
            icon: data.icon,
            image: data.image,
            badge: data.badge,
            data: data.data,
            actions: data.actions
        })
    );
});

self.addEventListener('notificationclick', function (event) {
    event.notification.close();

    const url = event.notification.data?.url;

    if (event.action === 'dismiss') {
        return;
    }

    if ((!event.action || event.action === 'open_url') && url) {
        event.waitUntil(clients.openWindow(url));
    }
});
