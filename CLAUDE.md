# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a static personal portfolio website for Yusuf Adiputera, a Lead Software Engineer. The site is a Progressive Web App (PWA) deployed via GitHub Pages at https://adiputera.github.io/

## Architecture

### Static Site Structure
- **HTML Pages**: Main portfolio (index.html), FAQ pages in English and Indonesian (faq.html, faq-id.html)
- **Progressive Web App**: Includes service worker (sw.js), manifest.json, and PWA icons for offline capabilities
- **Client-Side JavaScript**: Theme toggle, service worker registration, FAQ interactions (src/index.js)
- **CSS Theming**: CSS custom properties for light/dark mode switching (src/master.css)
- **SEO Optimization**: Structured data (JSON-LD), Open Graph meta tags, sitemap.xml, robots.txt

### Key Files
- `index.html` - Main portfolio page with work experience, skills, achievements
- `faq.html` / `faq-id.html` - FAQ pages (English/Indonesian)
- `sw.js` - Service worker for caching and push notifications
- `manifest.json` - PWA manifest
- `src/index.js` - Theme toggle and service worker registration
- `src/master.css` - Main stylesheet with CSS custom properties for theming
- Minified versions: `*.min.js` and `*.min.css` are production versions

### Version Management
Asset files use cache-busting query parameters (e.g., `?v=202510041010`). When updating CSS/JS files, increment this version parameter in HTML files to force cache refresh.

## Development Commands

Since this is a static site, there are no build commands. Development workflow:

1. **Local Development**: Open HTML files directly in browser or use a simple HTTP server:
   ```bash
   python3 -m http.server 8000
   ```
   Then visit http://localhost:8000

2. **Minification**: When updating source files, minify CSS and JS:
   - CSS: Minify `src/master.css` to `src/master.min.css`
   - JS: Minify `src/index.js` to `src/index.min.js`

3. **Deploy**: Push changes to `main` branch. GitHub Pages auto-deploys from root directory.

## Content Management

### Updating Content
- **Resume/Experience**: Edit HTML directly in `index.html`
- **FAQ**: Edit `faq.html` (English) or `faq-id.html` (Indonesian)
- **SEO Metadata**: Update meta tags and JSON-LD structured data in `<head>` sections
- **Cache Busting**: After updating CSS/JS, increment version parameter in all HTML files

### PWA Configuration
- **Service Worker Cache**: Update cached files array in `sw.js` when adding new static assets
- **App Icons**: Icons stored in `images/` directory (128px, 192px, 256px, 384px, 512px)
- **Manifest**: Edit `manifest.json` for PWA metadata

## Theme System

The site supports light/dark themes using CSS custom properties:
- Theme preference stored in localStorage
- Toggle button triggers `toggleTheme()` function in src/index.js
- CSS variables defined in `:root` and `[data-theme="dark"]` selectors

## SEO and Metadata

- **Structured Data**: JSON-LD schema for Person type in index.html
- **Meta Tags**: Comprehensive Open Graph, Twitter Card, and job-related meta tags
- **Sitemap**: sitemap.xml and sitemap.txt for search engines
- **Verification Files**: Google and Yandex verification HTML files in root

## Important Notes

- This is a **static site** - no build process, server-side rendering, or backend
- All changes must maintain SEO optimization (structured data, meta tags, semantic HTML)
- Ensure accessibility: semantic HTML, alt text, ARIA labels where needed
- Keep minified versions in sync with source files
- Test PWA functionality after service worker changes
- Maintain bilingual content (English and Indonesian) consistency
