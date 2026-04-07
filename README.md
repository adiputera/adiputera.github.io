# Yusuf Adiputera Portfolio — Jekyll Site

[![GitHub Pages](https://img.shields.io/badge/deployed%20on-GitHub%20Pages-blue)](https://adiputera.github.io/)
[![Jekyll](https://img.shields.io/badge/built%20with-Jekyll%203.9-red)](https://jekyllrb.com/)
[![PWA](https://img.shields.io/badge/PWA-enabled-success)](https://adiputera.github.io/)

Personal portfolio website showcasing professional experience, technical skills, achievements, and published articles. Built with Jekyll for easy content management and deployed via GitHub Pages.

**Live Site**: [https://adiputera.github.io/](https://adiputera.github.io/)

---

## Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Content Management](#content-management)
- [Asset Pipeline](#asset-pipeline)
- [Date Management](#date-management)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Testing](#testing)

---

## Features

- **Bilingual Support** — English and Indonesian versions with data-driven content
- **Progressive Web App (PWA)** — Offline capability with service worker caching
- **Dark/Light Theme** — User preference persisted in localStorage
- **Markdown Articles** — Technical articles managed as Markdown files
- **SEO Optimized** — JSON-LD schemas (Person, Article, FAQPage, ProfilePage, BreadcrumbList, ItemList, WebPage), Open Graph tags, sitemaps
- **Performance** — Minified assets with cache-busting, optimized images
- **Responsive Design** — Mobile-first CSS with CSS custom properties
- **Auto-Generated Sitemaps** — Dynamic XML and TXT sitemaps via Jekyll

---

## Architecture

### Static Site Generator
- **Jekyll 3.9.0** (via `github-pages` gem for GitHub Pages compatibility)
- **Ruby 3.x** required (.ruby-version: 3.1.7)
- **kramdown** for Markdown processing (smart quotes/typography disabled for consistency)
- **YAML Data Files** for centralized content management

### Data-Driven Bilingual System
- Single set of templates/layouts shared across languages
- Language-specific content in `_data/en.yml` and `_data/id.yml`
- Page-specific data in separate files (e.g., `_data/short_en.yml`, `_data/skills_page_en.yml`)
- Pages use `page.lang` front matter to select data source
- Templates load data via `{% assign data = site.data[page.lang] %}`

### Layout Hierarchy
- `default.html` — Base layout (head, body wrapper, scripts)
- `home.html` — Homepage (extends default)
- `short.html` — Short/condensed resume (extends default)
- `skills.html` — Skills detail page (extends default)
- `faq.html` — FAQ page (extends default)
- `article.html` — Technical articles (extends default)
- `page.html` — Generic page (extends default)

---

## Quick Start

### Prerequisites
- **Ruby 3.x** (Ruby 4.0+ not compatible with Jekyll 3.9.0)
- **Bundler** gem installed
- Ruby is managed via **rbenv** (not system Ruby or rvm)

### Installation

```bash
git clone https://github.com/adiputera/adiputera.github.io.git
cd adiputera.github.io
bundle install
```

### Local Development

```bash
# Start development server with live reload
bundle exec jekyll serve --livereload

# Build only (no server)
bundle exec jekyll build
```

Access at http://localhost:4000

### Validate YAML

```bash
ruby -ryaml -e "YAML.load_file('_data/en.yml')" && echo "OK"
ruby -ryaml -e "YAML.load_file('_data/id.yml')" && echo "OK"
```

---

## Content Management

### Quick Reference

| Task | Files to Edit |
|------|---------------|
| Update experience, skills, achievements | `_data/en.yml` + `_data/id.yml` |
| Update short/condensed resume | `_data/short_en.yml` + `_data/short_id.yml` |
| Update skills detail page | `_data/skills_page_en.yml` + `_data/skills_page_id.yml` |
| Update FAQ content | `_data/faq_en.yml` + `_data/faq_id.yml` |
| Update Person schema | `_data/schema_person.json` + `_data/schema_person_id.json` |
| Add new article | Create `_articles/new-article.md` |
| Update site metadata | `_data/meta.yml` |
| Update last modified dates | `_data/lastmod.yml` |

### Adding a New Article

Create `_articles/my-new-article.md`:

```markdown
---
layout: article
title: "Article Title"
description: "Article description for SEO"
date: 2027-01-15
permalink: /articles/my-new-article/
breadcrumb: "Articles"
breadcrumb_short: "Short Title"
snippet: "English snippet shown on homepage article list"
snippet_id: "Indonesian snippet for ID homepage"
canonical_url: "https://original-source.com/article"
canonical_source: "Source Name"
---

Your Markdown content here...
```

Front matter fields:
- `snippet` / `snippet_id` — Short description shown on homepage (EN/ID)
- `canonical_url` + `canonical_source` — Adds "Originally published at..." footer
- `breadcrumb` + `breadcrumb_short` — Breadcrumb navigation labels

Auto-updates on build:
- Sitemap includes new article
- Article page generates at the permalink
- Homepage article list updates (sorted by date, newest first)
- SEO schemas auto-generate (Person, Article, BreadcrumbList)

### Adding a New Page (Bilingual)

1. Create both language versions (e.g., `newpage.html` + `newpage-id.html`)
2. Set front matter: `layout`, `lang`, `permalink`, `permalink_en`/`permalink_id`
3. Add lastmod entry to `_data/lastmod.yml`
4. Add sitemap entry to `sitemap.xml`
5. Update both `_data/en.yml` and `_data/id.yml` if the page uses shared data

---

## Asset Pipeline

### CSS/JS Workflow

Source files are in `src/` with corresponding `.min.` versions. An npm build script handles minification and cache-busting.

**After editing `src/master.css` or `src/index.js`:**

```bash
# Install build dependencies (first time only)
npm install

# Minify CSS + JS and bump asset_version in one command
npm run build
```

This runs:
1. `cleancss` to minify `src/master.css` -> `src/master.min.css`
2. `terser` to minify `src/index.js` -> `src/index.min.js`
3. `scripts/bump-version.js` to update `asset_version` in `_config.yml` and query strings in `sw.js`

The `asset_version` (format: `YYYYMMDDHHNN`) is appended as `?v=...` to CSS/JS URLs for cache-busting.

**Individual commands:**

```bash
npm run minify:css   # Minify CSS only
npm run minify:js    # Minify JS only
npm run minify       # Minify both CSS and JS
npm run version      # Bump asset_version only (no minification)
npm run build        # Minify + bump version (full pipeline)
```

### Service Worker

`sw.js` cache references are updated automatically by `npm run version` / `npm run build`. The browser also checks for service worker updates byte-by-byte on each page load via `reg.update()`.

---

## Date Management

All page last-modified dates and published dates are managed in a single file: `_data/lastmod.yml`.

```yaml
# Last modified — update when page content changes
home_en: 2026-03-02
home_id: 2026-03-02
short_en: 2026-03-02
faq_id: 2026-04-07    # Updated independently per language

# Published dates — set once, should not change
published:
  home: 2025-07-07
  short: 2025-07-07
  skills: 2026-02-27
  faq: 2025-10-05
```

Used by:
- **Sitemap** (`sitemap.xml`) — `<lastmod>` values
- **Schema markup** — `datePublished` and `dateModified` in ProfilePage, FAQPage, WebPage schemas

Article dates come from article front matter (`date` and `date_modified`), not from this file.

---

## Deployment

### GitHub Pages (Automatic)

```bash
git add .
git commit -m "Update content"
git push origin main
```

GitHub Pages automatically builds and deploys in ~2 minutes.

### Pre-deployment Checklist

- [ ] YAML files validate (`ruby -ryaml -e "YAML.load_file('_data/en.yml')"`)
- [ ] `bundle exec jekyll build` succeeds
- [ ] If CSS/JS changed: run `npm run build` (minifies + bumps version)
- [ ] If content changed: relevant `lastmod` entry updated in `_data/lastmod.yml`
- [ ] Both EN and ID versions updated (if applicable)

---

## Project Structure

```
.
├── _config.yml                # Jekyll config (asset_version, collections, kramdown)
├── Gemfile                    # Ruby dependencies
├── .ruby-version              # Ruby version (3.1.7)
├── package.json               # npm scripts (minify CSS/JS, bump version)
├── scripts/
│   └── bump-version.js        # Auto-bumps asset_version in _config.yml + sw.js
│
├── _data/                     # Content data
│   ├── en.yml                 # English: experience, skills, achievements, UI labels
│   ├── id.yml                 # Indonesian: same structure as en.yml
│   ├── short_en.yml           # Short resume content (English)
│   ├── short_id.yml           # Short resume content (Indonesian)
│   ├── skills_page_en.yml     # Skills detail page (English)
│   ├── skills_page_id.yml     # Skills detail page (Indonesian)
│   ├── faq_en.yml             # FAQ content (English)
│   ├── faq_id.yml             # FAQ content (Indonesian)
│   ├── lastmod.yml            # Last modified dates for sitemap & schemas
│   ├── meta.yml               # Site metadata (analytics, OG defaults)
│   ├── schema_person.json     # Person schema (English)
│   └── schema_person_id.json  # Person schema (Indonesian)
│
├── _layouts/                  # Page templates
│   ├── default.html           # Base layout (head, body, scripts)
│   ├── home.html              # Homepage layout
│   ├── short.html             # Short resume layout
│   ├── skills.html            # Skills detail layout
│   ├── faq.html               # FAQ page layout
│   ├── article.html           # Article layout (breadcrumb + theme toggle)
│   └── page.html              # Generic page layout
│
├── _includes/                 # Reusable components
│   ├── head.html              # HEAD section (meta, SEO, CSS, all schemas)
│   ├── navigation.html        # Breadcrumb + language switcher
│   ├── footer.html            # Footer
│   ├── theme-toggle.html      # Dark/light theme button
│   ├── language-switcher.html # EN/ID switcher
│   ├── schema-person.html     # Person JSON-LD (language-aware)
│   ├── schema-profilepage.html # ProfilePage JSON-LD (home + short)
│   ├── schema-article.html    # Article JSON-LD
│   ├── schema-articlelist.html # ItemList JSON-LD (homepage articles)
│   ├── schema-breadcrumb.html # BreadcrumbList JSON-LD (language-aware)
│   ├── schema-faqpage.html    # FAQPage JSON-LD
│   └── schema-skills.html     # Skills ItemList + WebPage JSON-LD
│
├── _articles/                 # Markdown articles collection
│   ├── remote-debug-sap-commerce.md
│   ├── enable-image-upload-backoffice.md
│   ├── install-plugins-backoffice.md
│   └── sap-commerce-sso-bcrypt-error.md
│
├── Pages (root level):
│   ├── index.html / id.html           # Homepage (EN/ID)
│   ├── short.html / short-id.html     # Short resume (EN/ID)
│   ├── skills.html / skills-id.html   # Skills detail (EN/ID)
│   ├── faq.html / faq-id.html         # FAQ (EN/ID)
│   └── 404.html                       # Error page
│
├── src/                       # Source assets
│   ├── master.css             # Main styles (source)
│   ├── master.min.css         # Minified styles (deployed)
│   ├── index.js               # JavaScript (source)
│   └── index.min.js           # Minified JavaScript (deployed)
│
├── images/                    # Static images
│   ├── photo.webp             # Profile photo
│   ├── astra.svg              # Company logo
│   ├── *.png                  # PWA icons (128, 192, 256, 384, 512)
│   └── articles/              # Article images (by slug)
│
├── manifest.json              # PWA manifest
├── sw.js                      # Service worker
├── sitemap.xml                # Dynamic XML sitemap (Liquid template)
├── sitemap.txt                # Dynamic text sitemap
└── robots.txt                 # Search engine directives
```

---

## Testing

**Quick health check:**

```bash
# Validate YAML
ruby -ryaml -e "YAML.load_file('_data/en.yml')" && echo "OK"
ruby -ryaml -e "YAML.load_file('_data/id.yml')" && echo "OK"

# Build
bundle exec jekyll build

# Serve and check manually
bundle exec jekyll serve --livereload
```

See [TESTING.md](TESTING.md) for comprehensive testing procedures.

---

## License

Content: All rights reserved. Yusuf Adiputera.

Code: MIT License (Jekyll templates, layouts, includes, scripts)
