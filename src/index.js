if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").then(reg =>
        reg.update()
    ).catch(error => {
        console.debug("Service Worker registration failed:", error);
    });
}

function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    changeToggleThemeText(newTheme);
}

(function () {
    const saved = localStorage.getItem("theme");
    if (saved) {
        document.documentElement.setAttribute("data-theme", saved);
        changeToggleThemeText(saved);
    }
})();

function changeToggleThemeText(theme) {
    const toggleBtn = document.querySelector('.toggle-theme');
    toggleBtn.textContent = theme === "dark" ? '☀️ Light Mode' : '🌙 Dark Mode';
}

const notifyButton = document.getElementById("notify-btn");

function isIos() {
    return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
}

function updateNotifyUI() {
    if (typeof Notification === "undefined" || isIos()) {
        notifyButton.textContent = "⚠️ Notifications not supported on this browser";
        notifyButton.disabled = true;
        notifyButton.style.cursor = "default";
        return;
    }

    const permission = Notification.permission;

    if (permission === "granted") {
        notifyButton.textContent = "✅ You're already subscribed!";
        notifyButton.disabled = true;
        notifyButton.style.cursor = "default";
    } else if (permission === "denied") {
        notifyButton.textContent = "❌ Notifications are blocked by your browser";
        notifyButton.disabled = true;
        notifyButton.style.cursor = "default";
    }
}

const vapidPublicKey = "BDQm2phIYp4W1xoVrwisbYBDp-GbT5_kbBjEYQXtoFnsftS_kr05oXD6yBTr9nYIyAu2p6kgAp4VMm8J01IRLII";

function askNotificationPermission() {
    notifyButton.disabled = true;

    if (!("Notification" in window)) {
        notifyButton.textContent = "❌ Notifications not supported in this browser";
        return;
    }

    notifyButton.textContent = "🔄 Subscribing...";
    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            navigator.serviceWorker.getRegistration().then(registration => {
                if (!registration) {
                    return navigator.serviceWorker.register("/sw.js");
                }
                return registration;
            }).then(registration => {
                if (!registration) {
                    console.error("Service Worker registration failed.");
                    updateNotifyUI();
                    return;
                }
                registration.pushManager.subscribe({
                    userVisibleOnly: true,
                    applicationServerKey: urlBase64ToUint8Array(vapidPublicKey)
                }).then(subscription => {
                    if (!subscription) {
                        console.error("Failed to subscribe to push notifications.");
                        return;
                    }
                    fetch('https://neon-bombolone-54f610.netlify.app/api/subscribe', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(subscription)
                    });
                    registration.showNotification("✅ You're subscribed!", {
                        body: "I don't expect anyone would press that button, but you’ll be notified when I'm open to new roles.",
                        icon: "images/512.png",
                        badge: "images/badge.png"
                    });
                    updateNotifyUI();
                }).catch(error => {
                    console.error("Failed to subscribe:", error);
                    updateNotifyUI();
                });
            }).catch(error => {
                console.error("Service Worker registration not found:", error);
                updateNotifyUI();
            });
        } else if (permission === "denied" || permission === "default") {
            updateNotifyUI();
        }
    });
}

function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - base64String.length % 4) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const raw = atob(base64);
    return Uint8Array.from([...raw].map(c => c.charCodeAt(0)));
}

document.addEventListener("DOMContentLoaded", updateNotifyUI);