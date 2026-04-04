# Yusuf Adiputera Portfolio — Jekyll Site

[![GitHub Pages](https://img.shields.io/badge/deployed%20on-GitHub%20Pages-blue)](https://adiputera.github.io/)
[![Jekyll](https://img.shields.io/badge/built%20with-Jekyll%203.9-red)](https://jekyllrb.com/)
[![PWA](https://img.shields.io/badge/PWA-enabled-success)](https://adiputera.github.io/)

Personal portfolio website showcasing professional experience, technical skills, achievements, and published articles. Built with Jekyll for easy content management and deployed via GitHub Pages.

**Live Site**: [https://adiputera.github.io/](https://adiputera.github.io/)

---

## 📋 Table of Contents

- [Features](#features)
- [Architecture](#architecture)
- [Quick Start](#quick-start)
- [Content Management](#content-management)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Documentation](#documentation)
- [Migration Notes](#migration-notes)

---

## ✨ Features

- **🌐 Bilingual Support** — English and Indonesian versions with data-driven content
- **📱 Progressive Web App (PWA)** — Offline capability with service worker caching
- **🌓 Dark/Light Theme** — User preference persisted in localStorage
- **📝 Markdown Articles** — Technical articles managed as Markdown files
- **🔍 SEO Optimized** — JSON-LD schemas (Person, Article, BreadcrumbList), Open Graph tags, sitemaps
- **⚡ Performance** — Minified assets with cache-busting, optimized images
- **🎨 Responsive Design** — Mobile-first CSS with CSS custom properties
- **🔄 Auto-Generated Sitemaps** — Dynamic XML and TXT sitemaps via Jekyll
- **📊 Google Analytics** — Integrated tracking
- **♿ Accessible** — Semantic HTML, ARIA labels, proper heading structure

---

## 🏗️ Architecture

### Static Site Generator
- **Jekyll 3.9.0** (via `github-pages` gem for GitHub Pages compatibility)
- **Ruby 3.x** required (Ruby 4.x not compatible with Jekyll 3.9)
- **Liquid Templating** for layouts and components
- **YAML Data Files** for centralized content management
- **Markdown** for article content

### Data-Driven Bilingual System
- Single set of templates/layouts
- Language-specific content in `_data/en.yml` and `_data/id.yml`
- Pages use `page.lang` front matter to switch data sources
- Zero content duplication across language versions

### Key Technologies
- **HTML5** with semantic markup
- **CSS3** with custom properties for theming
- **Vanilla JavaScript** for theme toggle and service worker registration
- **Service Worker** for PWA offline caching and push notifications
- **JSON-LD** for structured data (Schema.org)

---

## 🚀 Quick Start

### Prerequisites
- **Ruby 3.x** (Ruby 4.0+ not compatible with Jekyll 3.9.0)
- **Bundler** gem installed

### Installation

```bash
# Clone the repository
git clone https://github.com/adiputera/adiputera.github.io.git
cd adiputera.github.io

# Install dependencies
bundle install
```

### Local Development

**Option 1: Install Ruby 3.3 (Recommended)**
```bash
# macOS with Homebrew
brew install ruby@3.3
echo 'export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
ruby --version  # Should show 3.3.x

# Install dependencies and run
bundle install
bundle exec jekyll serve --livereload
```

**Option 2: Use Docker**
```bash
docker run -it --rm \
  -v "$PWD":/site \
  -p 4000:4000 \
  ruby:3.3 bash

cd /site
bundle install
bundle exec jekyll serve --host 0.0.0.0
```

**Option 3: Deploy to GitHub Pages (No Local Build)**
```bash
# Push to main branch and GitHub Pages builds automatically
git add .
git commit -m "Your changes"
git push origin main
```

### Access the Site
- **Local**: http://localhost:4000
- **Production**: https://adiputera.github.io/

---

## 📝 Content Management

### Quick Reference

| Task | Files to Edit |
|------|---------------|
| Update work experience | `_data/en.yml` + `_data/id.yml` |
| Update skills | `_data/en.yml` + `_data/id.yml` |
| Update achievements | `_data/en.yml` + `_data/id.yml` |
| Add new article | Create `_articles/new-article.md` |
| Update site metadata | `_data/meta.yml` |
| Update SEO schema | `_data/schema_person.json` |

### Adding New Work Experience

Edit `_data/en.yml` and `_data/id.yml`:

```yaml
work_experience:
  - title: "Senior Software Architect"
    company: "Tech Company"
    location: "City, Country"
    duration: "Jan 2027 - Present"
    logo: "images/company-logo.png"
    logo_alt: "Company Logo Alt Text"
    summary: |
      Multi-paragraph job description.
      
      Use the pipe (|) for multi-line text.
    achievements:
      - "Achievement 1"
      - "Achievement 2"
```

### Adding New Article

Create `_articles/my-new-article.md`:

```markdown
---
layout: article
title: "How to Debug Kubernetes Pods"
description: "Step-by-step guide to debugging pods in production"
date: 2027-01-15
permalink: /articles/debug-kubernetes-pods/
breadcrumb: "Articles"
---

## Introduction

Your Markdown content here...

### Code Example

```bash
kubectl logs pod-name -n namespace
```

## Conclusion

Summary paragraph.
```

**Auto-updates**:
- ✅ Sitemap includes new article
- ✅ Article page auto-generates at `/articles/debug-kubernetes-pods/`
- ✅ SEO schemas auto-generate (Article + BreadcrumbList)

**Detailed Guide**: See [CONTENT_MANAGEMENT.md](CONTENT_MANAGEMENT.md)

---

## 🚢 Deployment

### GitHub Pages (Automatic)

```bash
git add .
git commit -m "Update content"
git push origin main
```

GitHub Pages automatically:
1. Detects Jekyll site
2. Builds with Ruby 3.x environment
3. Deploys to https://adiputera.github.io/
4. Completes in ~2 minutes

**Check build status**: [Actions tab](https://github.com/adiputera/adiputera.github.io/actions)

### Manual Build

```bash
# Build site (generates _site/ folder)
bundle exec jekyll build

# Serve locally
bundle exec jekyll serve
```

### Asset Updates (CSS/JS)

After updating `src/master.css` or `src/index.js`:

```bash
# 1. Minify assets (example with cleancss and uglifyjs)
cleancss -o src/master.min.css src/master.css
uglifyjs src/index.js -c -m -o src/index.min.js

# 2. Bust cache: Update version in _config.yml
# Change: asset_version: "202603261200"

# 3. Commit and deploy
git add src/ _config.yml
git commit -m "Update styles and bust cache"
git push origin main
```

---

## 📁 Project Structure

```
.
├── _config.yml              # Jekyll configuration
├── Gemfile                  # Ruby dependencies
├── .ruby-version            # Ruby version (3.3.0)
│
├── _data/                   # Content data (YAML/JSON)
│   ├── en.yml              # English content (work, skills, achievements)
│   ├── id.yml              # Indonesian content
│   ├── meta.yml            # Site metadata (title, URL, analytics)
│   └── schema_person.json  # Person schema (JSON-LD)
│
├── _layouts/                # Page templates
│   ├── default.html        # Base layout with head/nav/footer
│   ├── page.html           # Standard page layout
│   ├── article.html        # Article layout with breadcrumbs
│   └── faq.html            # FAQ page layout
│
├── _includes/               # Reusable components
│   ├── head.html           # Complete HEAD section (meta, SEO, CSS)
│   ├── navigation.html     # Header navigation
│   ├── footer.html         # Footer component
│   ├── theme-toggle.html   # Dark/light theme toggle button
│   ├── language-switcher.html  # EN/ID language switcher
│   ├── schema-person.html  # Person JSON-LD schema
│   └── schema-article.html # Article JSON-LD schema
│
├── _articles/               # Markdown articles collection
│   ├── remote-debug-sap-commerce.md
│   ├── enable-image-upload-backoffice.md
│   ├── install-plugins-backoffice.md
│   └── sap-commerce-sso-bcrypt-error.md
│
├── pages/                   # Static pages
│   ├── index.html          # Homepage (English)
│   ├── id.html             # Homepage (Indonesian)
│   ├── faq.html            # FAQ (English)
│   ├── faq-id.html         # FAQ (Indonesian)
│   ├── skills.html         # Skills (English)
│   ├── skills-id.html      # Skills (Indonesian)
│   ├── short.html          # Short version (English)
│   ├── short-id.html       # Short version (Indonesian)
│   └── 404.html            # Error page
│
├── src/                     # Source assets
│   ├── master.css          # Main styles (source)
│   ├── master.min.css      # Minified styles
│   ├── index.js            # Theme toggle + service worker (source)
│   └── index.min.js        # Minified JavaScript
│
├── images/                  # Static images
│   ├── photo.webp          # Profile photo
│   ├── *.png               # PWA icons (128, 192, 256, 384, 512)
│   └── articles/           # Article images by slug
│
├── PWA files:
│   ├── manifest.json       # PWA manifest
│   └── sw.js               # Service worker
│
├── SEO files:
│   ├── sitemap.xml         # Dynamic XML sitemap (Jekyll-generated)
│   ├── sitemap.txt         # Dynamic text sitemap (Jekyll-generated)
│   └── robots.txt          # Search engine directives
│
└── Documentation:
    ├── README.md            # This file (project overview)
    ├── CLAUDE.md            # Architecture guide for Claude AI
    ├── CONTENT_MANAGEMENT.md  # Content editing guide
    ├── TESTING.md           # Testing procedures
    └── README_RESUME.md     # Resume content (reference)
```

---

## 📚 Documentation

| Document | Purpose |
|----------|---------|
| [README.md](README.md) | **Project overview** (you are here) |
| [CONTENT_MANAGEMENT.md](CONTENT_MANAGEMENT.md) | **How to add/edit content** (work experience, skills, articles) |
| [TESTING.md](TESTING.md) | **Testing procedures** (YAML validation, builds, links, SEO) |
| [CLAUDE.md](CLAUDE.md) | **Architecture reference** for Claude AI assistant |
| [README_RESUME.md](README_RESUME.md) | Full resume content (reference only) |

---

## 🔄 Migration Notes

### Before Migration (Static HTML)
- **9 HTML pages**: ~35KB each with duplicated HEAD sections (300+ lines JSON-LD per page)
- **4 HTML articles**: ~40KB each with full HEAD duplication
- **Static sitemap**: Manual updates required
- **Bilingual**: Separate files for each language (18 total pages)
- **Total duplication**: ~4000+ lines across files

### After Migration (Jekyll)
- **9 Jekyll pages**: ~6KB each (83% reduction)
- **4 Markdown articles**: ~3KB each (92% reduction)
- **Dynamic sitemaps**: Auto-generated from collections
- **Bilingual**: Single templates + data files (`_data/en.yml` + `_data/id.yml`)
- **Content management**: YAML data files + Markdown articles
- **Duplication eliminated**: ~95% reduction

### Benefits
✅ **Easier content updates** — Edit YAML/Markdown instead of HTML  
✅ **No duplication** — Single source of truth for content  
✅ **Auto-generated SEO** — Sitemaps and schemas from data  
✅ **Bilingual simplified** — One template set, two data files  
✅ **Maintainable** — Clear separation of content and presentation  

---

## 🧪 Testing

See [TESTING.md](TESTING.md) for comprehensive testing procedures.

**Quick health check**:
```bash
# Validate YAML syntax
ruby -ryaml -e "YAML.load_file('_data/en.yml')"
ruby -ryaml -e "YAML.load_file('_data/id.yml')"

# Build site
bundle exec jekyll build

# Check for broken links
gem install html-proofer
htmlproofer ./_site --disable-external --allow-hash-href
```

---

## 🤝 Contributing

This is a personal portfolio site, but suggestions are welcome:

1. Open an issue for bugs or suggestions
2. Fork the repo for contributions
3. Submit a pull request

---

## 📄 License

Content: © 2026 Yusuf Adiputera. All rights reserved.

Code: MIT License (Jekyll templates, layouts, includes, scripts)

---

## 🔗 Links

- **Live Site**: [https://adiputera.github.io/](https://adiputera.github.io/)
- **LinkedIn**: [linkedin.com/in/yusuf-adiputera](https://www.linkedin.com/in/yusuf-adiputera)
- **Email**: [yusuf@adiputera.id](mailto:yusuf@adiputera.id)

---

## 📱 Contact

**Yusuf Adiputera**  
Lead Software Engineer  
📧 yusuf@adiputera.id  
🔗 [LinkedIn](https://www.linkedin.com/in/yusuf-adiputera)  
🌐 [Portfolio](https://adiputera.github.io/)

---

**Built with ❤️ using Jekyll and deployed on GitHub Pages**
