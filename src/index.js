if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").then(registration => {
        console.log("ServiceWorker successfully registered!");
        console.log(registration);
    }).catch(error => {
        console.log("ServiceWorker registration failed!");
        console.log(error);
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

function updateNotifyUI() {
    if (Notification.permission === "granted") {
        notifyButton.textContent = "✅ You're already subscribed!";
        notifyButton.disabled = true;
        notifyButton.style.cursor = "default";
    }
}

function askNotificationPermission() {
    if (!("Notification" in window)) {
        alert("This browser does not support notifications.");
        return;
    }

    Notification.requestPermission().then(permission => {
        if (permission === "granted") {
            new Notification("✅ You're subscribed!", {
                body: "You’ll be notified when Yusuf is open to new roles.",
                icon: "images/avatar.png",
                badge: "images/monogram-ya.png"
            });
        }
        updateNotifyUI();
    });
}

// On page load
document.addEventListener("DOMContentLoaded", updateNotifyUI);