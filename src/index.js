if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(registration => {
        reg.update();
    }).catch(error => {
        console.error("Service Worker registration failed:", error);
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
    const permission = Notification.permission;

    if (permission === "granted") {
        notifyButton.textContent = "✅ You're already subscribed!";
        notifyButton.disabled = true;
        notifyButton.style.cursor = "default";
    } else if (isIos() && !isInStandaloneMode()) {
        notifyButton.textContent = "ℹ️ On iOS, add to home screen to enable notifications";
        notifyButton.disabled = true;
        notifyButton.style.cursor = "default";
    } else if (permission === "denied") {
        notifyButton.textContent = "❌ Notifications are blocked by your browser";
        notifyButton.disabled = true;
        notifyButton.style.cursor = "default";
    }
}

function askNotificationPermission() {
    if (!("Notification" in window)) {
        notifyButton.textContent = "❌ Notifications not supported in this browser";
        notifyButton.disabled = true;
        return;
    }

    Notification.requestPermission();
    waitForNotificationPermission();
}

function waitForNotificationPermission(maxWait = 5000, intervalTime = 500) {
    const start = Date.now();

    const interval = setInterval(() => {
        const permission = Notification.permission;

        if (permission === "granted") {
            new Notification("✅ You're subscribed!", {
                body: "You’ll be notified when Yusuf is open to new roles.",
                icon: "images/avatar.png",
                badge: "images/monogram-ya.png"
            });
            updateNotifyUI();
            clearInterval(interval);
        } else if (permission === "denied") {
            updateNotifyUI();
            clearInterval(interval);
        } else if (Date.now() - start >= maxWait) {
            // Still 'default' after 5 seconds — give up
            updateNotifyUI();
            clearInterval(interval);
        }
    }, intervalTime);
}


document.addEventListener("DOMContentLoaded", updateNotifyUI);