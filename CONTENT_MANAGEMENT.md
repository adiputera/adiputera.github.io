# Content Management Guide

## Overview
This guide shows how to manage content in the Jekyll-powered portfolio site. All content updates are now centralized in YAML data files and Markdown articles — no more duplicating HTML across multiple pages!

---

## Quick Reference

| What to Update | File to Edit | Documentation |
|----------------|--------------|---------------|
| Work Experience | `_data/en.yml` + `_data/id.yml` | [Work Experience](#updating-work-experience) |
| Skills | `_data/en.yml` + `_data/id.yml` | [Skills](#updating-skills) |
| Achievements | `_data/en.yml` + `_data/id.yml` | [Achievements](#updating-achievements) |
| Add New Article | `_articles/new-article.md` | [Adding Articles](#adding-new-articles) |
| Update Article | `_articles/existing-article.md` | [Editing Articles](#editing-existing-articles) |
| Personal Info | `_data/meta.yml` | [Site Metadata](#updating-site-metadata) |
| Schema/SEO | `_data/schema_person.json` | [Person Schema](#updating-person-schema) |

---

## Updating Work Experience

### Location
- English: `_data/en.yml` → `work_experience` section
- Indonesian: `_data/id.yml` → `work_experience` section

### Structure
```yaml
work_experience:
  - title: "Job Title"
    company: "Company Name"
    location: "City, Country"
    duration: "Month YYYY - Present"
    logo: "images/company-logo.png"
    logo_alt: "Company Logo Alt Text"
    summary: |
      Multi-paragraph job summary.
      
      Use the pipe (|) for multi-line descriptions.
    achievements:
      - "Achievement 1"
      - "Achievement 2"
      - "Achievement 3"
```

### Example: Adding a New Job
```yaml
work_experience:
  # Add new job at the top (most recent first)
  - title: "Senior Software Architect"
    company: "Tech Innovations Inc"
    location: "San Francisco, USA"
    duration: "January 2027 - Present"
    logo: "images/tech-innovations-logo.png"
    logo_alt: "Tech Innovations Inc Logo"
    summary: |
      Leading architecture design for cloud-native applications.
      
      Responsible for technical strategy and team mentorship.
    achievements:
      - "Designed microservices architecture serving 10M+ users"
      - "Reduced infrastructure costs by 40% through optimization"
      - "Led team of 15 engineers across 3 time zones"
  
  # Existing jobs follow...
  - title: "Lead Software Engineer"
    company: "GFT Technologies"
    # ... rest of existing jobs
```

### Steps
1. Open `_data/en.yml` and `_data/id.yml`
2. Find `work_experience:` section
3. Add new job entry at the top (most recent first)
4. **Important**: Use `summary: |` (pipe) for multi-line descriptions
5. Save both files
6. Changes auto-reflect on homepage when Jekyll rebuilds

---

## Updating Skills

### Location
- `_data/en.yml` → `skills` section
- `_data/id.yml` → `skills` section

### Structure
```yaml
skills:
  backend:
    - name: "Java"
      level: "Expert"
      description: "15+ years experience"
    - name: "Python"
      level: "Advanced"
      description: "8 years experience"
  
  frontend:
    - name: "JavaScript"
      level: "Advanced"
    - name: "React"
      level: "Intermediate"
  
  cloud:
    - name: "AWS"
      level: "Advanced"
    - name: "Azure"
      level: "Intermediate"
  
  database:
    - name: "PostgreSQL"
      level: "Expert"
    - name: "MongoDB"
      level: "Advanced"
```

### Example: Adding a New Skill
```yaml
skills:
  backend:
    - name: "Java"
      level: "Expert"
      description: "15+ years of enterprise development"
    - name: "Go"  # NEW SKILL
      level: "Intermediate"
      description: "Building microservices and CLI tools"
    # ... existing skills
```

### Steps
1. Open `_data/en.yml` and `_data/id.yml`
2. Find the `skills` section
3. Add skill to appropriate category (backend, frontend, cloud, database)
4. Optional: Include `description` for additional context
5. Save both files

---

## Updating Achievements

### Location
- `_data/en.yml` → `achievements` list
- `_data/id.yml` → `achievements` list

### Structure
```yaml
achievements:
  - "Led migration of 50+ microservices to Kubernetes"
  - "Published 10+ technical articles on SAP Community"
  - "Designed high-performance API handling 100K+ requests/minute"
```

### Example: Adding New Achievement
```yaml
achievements:
  # Add at the top for most prominent placement
  - "Architected AI-powered recommendation engine serving 5M users"
  - "Led migration of 50+ microservices to Kubernetes"
  # ... existing achievements
```

### Steps
1. Open `_data/en.yml` and `_data/id.yml`
2. Find `achievements:` list
3. Add new achievement (most recent at top)
4. Keep it concise (one line per achievement)
5. Save both files

---

## Adding New Articles

### Location
Create new Markdown file in `_articles/` directory

### Template
```markdown
---
layout: article
title: "Your Article Title"
description: "Brief description for meta tags and SEO"
date: 2027-01-15
canonical_url: "https://original-publication-url.com/article"  # Optional
permalink: /articles/your-article-slug/
breadcrumb: "Articles"
---

## Introduction

Your article content in Markdown format.

### Subheading

Content with **bold** and *italic* text.

### Code Examples

```java
public class Example {
    public static void main(String[] args) {
        System.out.println("Hello World");
    }
}
```

### Lists

**Numbered list:**
1. First item
2. Second item
3. Third item

**Bullet list:**
- Point one
- Point two
- Point three

### Images

![Alt text](../images/articles/your-article-slug/screenshot.png)

### Links

Check out [this resource](https://example.com) for more information.

## Conclusion

Summary paragraph.
```

### Steps
1. Create new file: `_articles/your-article-slug.md`
2. Copy template above
3. Update front matter (title, description, date, permalink)
4. Write content in Markdown
5. Add images to `images/articles/your-article-slug/`
6. Save file
7. Article auto-generates at `/articles/your-article-slug/`
8. **Automatic updates**:
   - Sitemap includes new article
   - Article appears on homepage (if listed in _data files)
   - Schema.org Article metadata generated

### Front Matter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `layout` | ✅ Yes | Must be "article" |
| `title` | ✅ Yes | Article title (used in <h1> and <title>) |
| `description` | ✅ Yes | Meta description for SEO |
| `date` | ✅ Yes | Publication date (YYYY-MM-DD format) |
| `permalink` | ✅ Yes | URL path (e.g., `/articles/my-article/`) |
| `breadcrumb` | ✅ Yes | Breadcrumb label (usually "Articles") |
| `canonical_url` | ⬜ No | Original publication URL (for republished content) |

---

## Editing Existing Articles

### Location
`_articles/[article-slug].md`

### Steps
1. Open the article Markdown file
2. Edit content as needed
3. Update `date` in front matter if republishing
4. Save file
5. Changes reflect after Jekyll rebuild

### Example Files
- `_articles/remote-debug-sap-commerce.md`
- `_articles/enable-image-upload-backoffice.md`
- `_articles/install-plugins-backoffice.md`
- `_articles/sap-commerce-sso-bcrypt-error.md`

---

## Updating Site Metadata

### Location
`_data/meta.yml`

### Structure
```yaml
site:
  title: "Yusuf Adiputera - Lead Software Engineer"
  description: "Portfolio and resume"
  url: "https://adiputera.github.io"
  author: "Yusuf Adiputera"
  asset_version: "202603251700"
  
google_analytics: "G-XXXXXXXXXX"
```

### Common Updates

**Change site title:**
```yaml
site:
  title: "Your New Title"
```

**Update analytics:**
```yaml
google_analytics: "G-YOUR-NEW-ID"
```

**Bust asset cache (after CSS/JS changes):**
```yaml
site:
  asset_version: "202603261200"  # Update timestamp
```

---

## Updating Person Schema

### Location
`_data/schema_person.json`

### Structure
```json
{
  "@context": "https://schema.org",
  "@type": "Person",
  "name": "Yusuf Adiputera",
  "jobTitle": "Lead Software Engineer",
  "description": "Experienced software engineer...",
  "url": "https://adiputera.github.io",
  "email": "adiputera@gmail.com",
  "nationality": "Indonesian",
  "knowsLanguage": [
    {
      "@type": "Language",
      "name": "Indonesian",
      "alternateName": "id"
    },
    {
      "@type": "Language",
      "name": "English",
      "alternateName": "en"
    }
  ],
  "knowsAbout": [
    "Java",
    "Spring Boot",
    "SAP Commerce Cloud"
  ]
}
```

### Common Updates

**Change job title:**
```json
"jobTitle": "Senior Software Architect"
```

**Add skills:**
```json
"knowsAbout": [
  "Java",
  "Spring Boot",
  "SAP Commerce Cloud",
  "Kubernetes",
  "AWS"
]
```

**Update contact:**
```json
"email": "newemail@example.com"
```

---

## Content Management Workflow

### Daily Content Updates
```bash
# 1. Edit content files
vim _data/en.yml              # Update work experience
vim _articles/new-post.md     # Add new article

# 2. Preview locally (if Ruby 3.x installed)
bundle exec jekyll serve --livereload

# 3. Visit http://localhost:4000 to preview

# 4. Commit and push
git add .
git commit -m "Add new article: How to Debug Kubernetes"
git push origin main

# 5. GitHub Pages auto-deploys in ~2 minutes
```

### Asset Updates (CSS/JS)
```bash
# 1. Edit source files
vim src/master.css
vim src/index.js

# 2. Minify (use your preferred tool)
# Example with cleancss and uglifyjs:
cleancss -o src/master.min.css src/master.css
uglifyjs src/index.js -c -m -o src/index.min.js

# 3. Bust cache: Update asset_version in _config.yml
vim _config.yml
# Change: asset_version: "202603261200"

# 4. Commit and push
git add src/ _config.yml
git commit -m "Update styles and bust cache"
git push origin main
```

---

## Bilingual Content Management

### Rule: Keep EN and ID in Sync

When updating content, **always update both files**:
- `_data/en.yml` (English)
- `_data/id.yml` (Indonesian)

### Example Workflow
```bash
# 1. Add new work experience in English
vim _data/en.yml
# Add: title: "Senior Architect"

# 2. Add Indonesian translation
vim _data/id.yml
# Add: title: "Arsitek Senior"

# 3. Verify both files have matching structure
diff <(grep "^  - title" _data/en.yml) \
     <(grep "^  - title" _data/id.yml)
```

### Translation Checklist
- [ ] Work experience titles and descriptions translated
- [ ] Skills names translated (if applicable)
- [ ] Achievements translated
- [ ] Article descriptions translated (if creating bilingual articles)

---

## File Organization

```
_data/
├── en.yml              ← English content (work, skills, achievements)
├── id.yml              ← Indonesian content (work, skills, achievements)
├── meta.yml            ← Site metadata (title, URL, analytics)
└── schema_person.json  ← SEO person schema (JSON-LD)

_articles/
├── article-1.md        ← Markdown articles
├── article-2.md
└── article-3.md

images/
├── photo.webp          ← Profile photo
├── company-logo.png    ← Company logos
└── articles/
    ├── article-1/      ← Article images organized by article
    │   ├── screenshot1.png
    │   └── screenshot2.png
    └── article-2/
        └── diagram.png
```

---

## Best Practices

### YAML Editing
1. **Multi-line strings**: Use `|` (pipe) for paragraphs
   ```yaml
   summary: |
     First paragraph.
     
     Second paragraph.
   ```

2. **Single-line strings**: Use quotes for special characters
   ```yaml
   title: "Lead Software Engineer - Java & Cloud"
   ```

3. **Validate syntax** after editing:
   ```bash
   ruby -ryaml -e "YAML.load_file('_data/en.yml')"
   ```

### Markdown Editing
1. **Headers**: Use `##` for h2, `###` for h3 (Jekyll uses `#` for h1 from front matter title)
2. **Code blocks**: Use triple backticks with language:
   ````markdown
   ```java
   public class Example {}
   ```
   ````
3. **Images**: Use relative paths from article location:
   ```markdown
   ![Description](../images/articles/my-article/screenshot.png)
   ```

### Git Workflow
```bash
# Create feature branch for major updates
git checkout -b update-work-experience
vim _data/en.yml
vim _data/id.yml
git add _data/
git commit -m "Add Senior Architect position"
git push origin update-work-experience

# Create PR on GitHub, review, merge to main
```

---

## Comparison: Before vs After

### Before Migration (Static HTML)

**Add new work experience:**
1. Edit `index.html` — find experience section, add ~50 lines of HTML
2. Edit `id.html` — repeat same process with Indonesian translation
3. Update Person JSON-LD in `index.html` (300 lines)
4. Update Person JSON-LD in `id.html` (300 lines)
5. Update sitemap.xml manually
6. Total: ~800+ lines changed

**Add new article:**
1. Create `articles/new-article.html` with full HTML structure (~400 lines)
2. Copy HEAD section from another article (~260 lines)
3. Add article to `index.html` article list
4. Add article to `id.html` article list
5. Add article to `faq.html` article list
6. Add article to `faq-id.html` article list
7. Update sitemap.xml manually
8. Total: ~700+ lines, 7 files edited

### After Migration (Jekyll)

**Add new work experience:**
1. Edit `_data/en.yml` — add ~10 lines
2. Edit `_data/id.yml` — add ~10 lines (translation)
3. Total: ~20 lines, 2 files edited
4. Sitemap auto-updates ✨

**Add new article:**
1. Create `_articles/new-article.md` with Markdown (~50 lines)
2. Total: ~50 lines, 1 file edited
3. Sitemap auto-updates ✨
4. Homepage auto-updates (if added to _data files) ✨
5. SEO schemas auto-generate ✨

**Result**: ~95% reduction in manual work!

---

## Troubleshooting

### Issue: YAML syntax error after editing
**Error**: `Invalid YAML syntax`

**Solution**: Check for:
- Missing colon after key
- Incorrect indentation (use 2 spaces, not tabs)
- Missing pipe `|` for multi-line strings
- Unquoted special characters

**Validate**:
```bash
ruby -ryaml -e "YAML.load_file('_data/en.yml')"
```

### Issue: Article not appearing on site
**Check**:
1. Front matter has `layout: article`
2. Permalink doesn't conflict with existing pages
3. File is in `_articles/` directory
4. Jekyll build completed successfully

### Issue: Changes not reflecting
**Solution**:
1. Stop Jekyll server (Ctrl+C)
2. Delete `_site/` directory
3. Rebuild: `bundle exec jekyll serve`

---

## Quick Commands Cheat Sheet

```bash
# Validate YAML files
ruby -ryaml -e "YAML.load_file('_data/en.yml')"
ruby -ryaml -e "YAML.load_file('_data/id.yml')"

# Build site
bundle exec jekyll build

# Serve locally with live reload
bundle exec jekyll serve --livereload

# Check for broken links
htmlproofer ./_site --disable-external --allow-hash-href

# Count lines of code
find _data _layouts _includes _articles -type f | xargs wc -l

# Find backup files
find . -name "*.backup"

# Deploy to GitHub Pages
git add .
git commit -m "Your commit message"
git push origin main
```

---

## Resources

- **Jekyll Documentation**: https://jekyllrb.com/docs/
- **YAML Syntax**: https://yaml.org/spec/1.2.2/
- **Markdown Guide**: https://www.markdownguide.org/
- **Liquid Templating**: https://shopify.github.io/liquid/

---

## Questions?

- Check [TESTING.md](TESTING.md) for verification procedures
- Check [CLAUDE.md](CLAUDE.md) for architecture details
- Review [README.md](README.md) for project overview
