if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js").then(reg =>
        reg.update()
    ).catch(error => {
        console.debug("Service Worker registration failed:", error);
    });
}

const THEME_COLORS = { light: "#ffffff", dark: "#1e1e1e" };

function updateThemeColor(theme) {
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) {
        meta.setAttribute("content", THEME_COLORS[theme] || THEME_COLORS.light);
    }
}

function toggleTheme() {
    const html = document.documentElement;
    const newTheme = html.getAttribute("data-theme") === "dark" ? "light" : "dark";
    html.setAttribute("data-theme", newTheme);
    localStorage.setItem("theme", newTheme);
    changeToggleThemeText(newTheme);
    updateThemeColor(newTheme);
}

(function () {
    const saved = localStorage.getItem("theme");
    if (saved) {
        document.documentElement.setAttribute("data-theme", saved);
        changeToggleThemeText(saved);
        updateThemeColor(saved);
    }
})();

function changeToggleThemeText(theme) {
    const toggleBtn = document.querySelector('.toggle-theme');
    if (!toggleBtn) return;
    toggleBtn.textContent = theme === "dark" ? '☀️ Light Mode' : '🌙 Dark Mode';
}

document.addEventListener("DOMContentLoaded", () => {
    // Mobile menu toggle
    const mobileMenuToggle = document.querySelector('.mobile-menu-toggle');
    const navLinksContainer = document.querySelector('.nav-links-container');

    if (mobileMenuToggle && navLinksContainer) {
        mobileMenuToggle.addEventListener('click', () => {
            const isExpanded = mobileMenuToggle.getAttribute('aria-expanded') === 'true';
            mobileMenuToggle.setAttribute('aria-expanded', !isExpanded);
            navLinksContainer.classList.toggle('active');
        });

        // Close menu when a link is clicked
        navLinksContainer.querySelectorAll('a').forEach(link => {
            link.addEventListener('click', () => {
                mobileMenuToggle.setAttribute('aria-expanded', 'false');
                navLinksContainer.classList.remove('active');
            });
        });
    }

    // Smooth scroll for internal links
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                e.preventDefault();
                const navWrapper = document.querySelector('.nav-wrapper');
                const navHeight = navWrapper ? navWrapper.offsetHeight : 0;
                const targetPosition = targetElement.getBoundingClientRect().top + window.pageYOffset - navHeight - 20;
                
                window.scrollTo({
                    top: targetPosition,
                    behavior: 'smooth'
                });

                // Update URL hash without jumping
                history.pushState(null, null, targetId);
            }
        });
    });

    document.querySelectorAll(".faq-question").forEach(q => {
        q.addEventListener("click", () => {
            const item = q.closest(".faq-item");
            item.classList.toggle("open");
        });
    });

    // Share buttons logic
    const copyBtn = document.getElementById('copy-link-btn');
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const url = copyBtn.getAttribute('data-url');
            navigator.clipboard.writeText(url).then(() => {
                copyBtn.classList.add('success');
                const copyIcon = copyBtn.querySelector('.copy-icon');
                const checkIcon = copyBtn.querySelector('.check-icon');
                if (copyIcon && checkIcon) {
                    copyIcon.style.display = 'none';
                    checkIcon.style.display = 'block';
                    setTimeout(() => {
                        copyBtn.classList.remove('success');
                        copyIcon.style.display = 'block';
                        checkIcon.style.display = 'none';
                    }, 2000);
                }
            });
        });
    }

    const systemShareBtn = document.getElementById('system-share-btn');
    if (systemShareBtn && navigator.share) {
        systemShareBtn.style.display = 'inline-flex';
        systemShareBtn.addEventListener('click', () => {
            const title = systemShareBtn.getAttribute('data-title');
            const url = systemShareBtn.getAttribute('data-url');
            navigator.share({
                title: title,
                url: url
            }).catch(console.error);
        });
    }
});