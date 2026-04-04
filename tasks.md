# Jekyll Conversion Tasks

**Status Legend**: ✅ Done | 🚧 In Progress | ⏸️ Blocked | ⏳ Not Started

Last Updated: 2026-04-04

---

## Phase 1: Jekyll Foundation Setup

- [ ] **Task 1.1**: Create `_config.yml` — Site configuration, cache version variable, collections setup
- [ ] **Task 1.2**: Create `Gemfile` — Ruby dependencies for GitHub Pages  
- [ ] **Task 1.3**: Update `.gitignore` — Add Jekyll build directories (_site/, .jekyll-cache/, .sass-cache/)

---

## Phase 2: Data-Driven Content Structure

- [ ] **Task 2.1**: Create `_data/en.yml` — English content data
  - [ ] Site metadata (title, description, keywords)
  - [ ] Navigation labels
  - [ ] Common UI strings
  - [ ] Skills list with categories
  - [ ] Work experience array
  - [ ] Education, certifications, achievements
  - [ ] Technical articles metadata
  - [ ] FAQ items

- [ ] **Task 2.2**: Create `_data/id.yml` — Indonesian translations (mirror structure of en.yml)
  - [ ] Site metadata
  - [ ] Navigation labels
  - [ ] Common UI strings
  - [ ] Skills list
  - [ ] Work experience
  - [ ] Education, certifications, achievements
  - [ ] Technical articles metadata
  - [ ] FAQ items

- [ ] **Task 2.3**: Create `_data/schema_person.json` — Extract 300+ line Person JSON-LD from index.html

- [ ] **Task 2.4**: Create `_data/meta.yml` — Shared SEO metadata
  - [ ] Open Graph defaults
  - [ ] Twitter Card defaults
  - [ ] Verification codes
  - [ ] Canonical URL patterns
  - [ ] hreflang configuration

---

## Phase 3: Layout & Component Templates

- [ ] **Task 3.1**: Create `_layouts/default.html` — Base layout
  - [ ] HTML5 boilerplate
  - [ ] Dynamic `<html lang="...">` based on page.lang
  - [ ] Include head.html
  - [ ] Include navigation.html
  - [ ] Include language-switcher.html
  - [ ] Include theme-toggle.html
  - [ ] Content placeholder {{ content }}
  - [ ] Include footer.html
  - [ ] Asset loading with {{ site.asset_version }}

- [ ] **Task 3.2**: Create `_layouts/page.html` — Standard page layout (extends default)
  - [ ] Main content wrapper
  - [ ] Breadcrumb navigation
  - [ ] Page-specific meta handling

- [ ] **Task 3.3**: Create `_layouts/article.html` — Article layout (extends default)
  - [ ] Article header with published date
  - [ ] Article content wrapper
  - [ ] "Originally published at" footer
  - [ ] Article JSON-LD structured data
  - [ ] Breadcrumb with article context

- [ ] **Task 3.4**: Create `_includes/head.html` — HEAD tag content
  - [ ] Meta charset, viewport
  - [ ] Language-aware title
  - [ ] Preload statements with asset_version
  - [ ] Meta tags from _data/meta.yml
  - [ ] Open Graph tags (language-aware)
  - [ ] Twitter Card meta
  - [ ] hreflang alternate links
  - [ ] Canonical URL
  - [ ] JSON-LD Person schema include
  - [ ] PWA manifest link
  - [ ] Apple touch icons
  - [ ] Google Analytics snippet
  - [ ] Theme detection script
  - [ ] CSS loading

- [ ] **Task 3.5**: Create `_includes/navigation.html` — Top navigation/breadcrumb
  - [ ] Breadcrumb trail
  - [ ] Responsive layout
  - [ ] Language-aware labels

- [ ] **Task 3.6**: Create `_includes/language-switcher.html` — EN/ID toggle
  - [ ] EN/ID switcher
  - [ ] Highlight active language
  - [ ] Links to alternate language version

- [ ] **Task 3.7**: Create `_includes/theme-toggle.html` — Dark/light mode button
  - [ ] Theme toggle button
  - [ ] Language-aware label

- [ ] **Task 3.8**: Create `_includes/footer.html` — Footer content
  - [ ] Copyright with dynamic year
  - [ ] Language-aware text

- [ ] **Task 3.9**: Create `_includes/schema-person.html` — Person JSON-LD include
  - [ ] Load _data/schema_person.json
  - [ ] Wrap in script tag

---

## Phase 4: Page Migration

- [ ] **Task 4.1**: Convert `index.html` to Jekyll
  - [ ] Add front matter (layout: page, lang: en, permalink: /)
  - [ ] Replace HEAD with {% include head.html %}
  - [ ] Replace navigation with {% include navigation.html %}
  - [ ] Extract main content only
  - [ ] Use Liquid tags for data references
  - [ ] Loop through work experience from _data/en.yml
  - [ ] Loop through skills from _data/en.yml
  - [ ] Loop through achievements from _data/en.yml
  - [ ] Remove duplicate JSON-LD schema

- [ ] **Task 4.2**: Convert `id.html` to Jekyll
  - [ ] Add front matter (layout: page, lang: id, permalink: /id, permalink_en: /)
  - [ ] Replace HEAD with {% include head.html %}
  - [ ] Replace navigation with {% include navigation.html %}
  - [ ] Reference site.data.id
  - [ ] Loop through content from _data/id.yml

- [ ] **Task 4.3**: Convert `faq.html` to Jekyll
  - [ ] Add front matter
  - [ ] Use layout: page
  - [ ] FAQ items from _data/en.yml
  - [ ] Liquid loop for FAQ accordion
  - [ ] Preserve JavaScript behavior

- [ ] **Task 4.4**: Convert `faq-id.html` to Jekyll
  - [ ] Add front matter
  - [ ] Use layout: page
  - [ ] FAQ items from _data/id.yml
  - [ ] Liquid loop for FAQ accordion

- [ ] **Task 4.5**: Convert `skills.html` to Jekyll
  - [ ] Add front matter
  - [ ] Reference _data/en.yml

- [ ] **Task 4.6**: Convert `skills-id.html` to Jekyll
  - [ ] Add front matter
  - [ ] Reference _data/id.yml

- [ ] **Task 4.7**: Convert `short.html` to Jekyll
  - [ ] Add front matter
  - [ ] Reference _data/en.yml

- [ ] **Task 4.8**: Convert `short-id.html` to Jekyll
  - [ ] Add front matter
  - [ ] Reference _data/id.yml

- [ ] **Task 4.9**: Convert `404.html` to Jekyll
  - [ ] Add front matter (layout: default, permalink: /404.html)

---

## Phase 5: Articles Collection

- [ ] **Task 5.1**: Convert article: enable-image-upload-backoffice
  - [ ] Create `_articles/enable-image-upload-backoffice.md`
  - [ ] Add front matter (title, date_published, original_url, etc.)
  - [ ] Convert HTML to Markdown
  - [ ] Preserve code blocks and images

- [ ] **Task 5.2**: Convert article: install-plugins-backoffice
  - [ ] Create `_articles/install-plugins-backoffice.md`
  - [ ] Add front matter
  - [ ] Convert HTML to Markdown

- [ ] **Task 5.3**: Convert article: remote-debug-sap-commerce
  - [ ] Create `_articles/remote-debug-sap-commerce.md`
  - [ ] Add front matter
  - [ ] Convert HTML to Markdown

- [ ] **Task 5.4**: Convert article: sap-commerce-sso-bcrypt-error
  - [ ] Create `_articles/sap-commerce-sso-bcrypt-error.md`
  - [ ] Add front matter
  - [ ] Convert HTML to Markdown

- [ ] **Task 5.5**: Delete old article HTML files
  - [ ] Delete articles/enable-image-upload-backoffice.html
  - [ ] Delete articles/install-plugins-backoffice.html
  - [ ] Delete articles/remote-debug-sap-commerce.html
  - [ ] Delete articles/sap-commerce-sso-bcrypt-error.html

- [ ] **Task 5.6**: Update article references in _data files
  - [ ] Update URLs in _data/en.yml to article permalinks
  - [ ] Update URLs in _data/id.yml to article permalinks

---

## Phase 6: PWA & Assets

- [ ] **Task 6.1**: Review and update `sw.js` service worker
  - [ ] Verify cached files array
  - [ ] Update if needed
  - [ ] Test service worker registration

- [ ] **Task 6.2**: Review `manifest.json`
  - [ ] Verify all paths correct
  - [ ] Test manifest loading

- [ ] **Task 6.3**: Update asset version
  - [ ] Increment asset_version in _config.yml
  - [ ] Verify cache-busting works

---

## Phase 7: SEO & Metadata

- [ ] **Task 7.1**: Update/generate `sitemap.xml`
  - [ ] Include all pages
  - [ ] Include all articles
  - [ ] Include both languages

- [ ] **Task 7.2**: Verify `robots.txt`
  - [ ] Check sitemap reference
  - [ ] Ensure correct

- [ ] **Task 7.3**: Verify hreflang implementation
  - [ ] Test language switcher
  - [ ] Verify meta tags render correctly

---

## Testing & Verification

- [ ] **Test 1**: Local Jekyll build
  - [ ] Run `bundle install`
  - [ ] Run `bundle exec jekyll serve`
  - [ ] All 8+ pages render at correct URLs
  - [ ] No broken links
  - [ ] No missing assets
  - [ ] Language switcher works
  - [ ] Theme toggle works
  - [ ] Articles accessible
  - [ ] Service worker registers
  - [ ] Manifest loads

- [ ] **Test 2**: Cross-page consistency
  - [ ] Meta tags correct on all pages
  - [ ] og:locale changes between en_US/id_ID
  - [ ] Person JSON-LD on every page
  - [ ] hreflang links present
  - [ ] Asset version parameters present

- [ ] **Test 3**: Content accuracy
  - [ ] Compare work experience against original
  - [ ] Compare skills against original
  - [ ] Verify article content preserved
  - [ ] Check FAQ Q&A complete

- [ ] **Test 4**: SEO validation
  - [ ] Google Rich Results Test
  - [ ] Validate hreflang
  - [ ] Check canonical URLs
  - [ ] Verify sitemap.xml validity

- [ ] **Test 5**: PWA functionality
  - [ ] Service worker installs
  - [ ] Offline mode works
  - [ ] Add to home screen (mobile test)
  - [ ] Push notifications work (if configured)

- [ ] **Test 6**: Bilingual switching
  - [ ] Language switcher links correct
  - [ ] Content changes appropriately
  - [ ] URLs match permalinks

- [ ] **Test 7**: GitHub Pages deployment
  - [ ] Push to main branch
  - [ ] Wait for build
  - [ ] Visit live site
  - [ ] No 404 errors
  - [ ] All functionality works

---

## Optional/Future Enhancements

- [ ] **Optional 1**: Set up npm build script for CSS/JS minification
  - [ ] Add package.json
  - [ ] Configure minification scripts
  - [ ] Update documentation

- [ ] **Optional 2**: Consider jekyll-include-cache for performance optimization

- [ ] **Optional 3**: Add RSS feed for articles using jekyll-feed plugin

---

## Notes

- **Minification**: Will use npm build script or manual minification, built locally (not GitHub Pages dependent)
- **GitHub Pages**: Jekyll build runs automatically on push to main branch
- **Local-only files**: CLAUDE.md and SEO_RECOMMENDATIONS.md remain .gitignore'd
