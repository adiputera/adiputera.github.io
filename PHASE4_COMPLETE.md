# Jekyll Conversion - Phase 4 Complete

## Completed: Page Migration (9/9 pages)

All HTML pages have been successfully converted to Jekyll format with data-driven content and reusable includes.

### Converted Pages

1. **index.html** ✅ (English portfolio)
   - Front matter with lang: en, permalink: /, permalink_id: /id
   - Uses _data/en.yml for all content
   - Liquid loops for work experience, skills, achievements, articles
   - Reduced from ~35KB to ~6KB (83% reduction)

2. **id.html** ✅ (Indonesian portfolio)
   - Front matter with lang: id, permalink: /id, permalink_en: /
   - Uses _data/id.yml for all content
   - Identical structure to index.html

3. **faq.html** ✅ (English FAQ)
   - Front matter with breadcrumb: "FAQ", permalink_id: /faq-id
   - Extensive Q&A content preserved (~1176 lines)
   - Uses Jekyll includes for navigation, theme toggle,  and footer

4. **faq-id.html** ✅ (Indonesian FAQ)
   - Front matter with breadcrumb: "FAQ", permalink_en: /faq
   - Indonesian title: "Pertanyaan Umum"
   - Mirror structure of English FAQ

5. **skills.html** ✅ (English technical skills)
   - Front matter with breadcrumb: "Skills", permalink_id: /skills-id
   - Detailed technical expertise content preserved

6. **skills-id.html** ✅ (Indonesian skills)
   - Front matter with breadcrumb: "Keahlian", permalink_en: /skills
   - Indonesian translations

7. **short.html** ✅ (Short resume version)
   - Converted with Jekyll includes
   - Shortened portfolio format

8. **short-id.html** ✅ (Indonesian short resume)
   - Indonesian version of short resume

9. **404.html** ✅ (Error page)
   - Simple error page with Jekyll layout

### Key Improvements

**Eliminated Duplication:**
- Removed ~300 lines of Person JSON-LD schema from each page (now in _data/schema_person.json)
- Removed ~80 lines of HEAD content from each page (now in _includes/head.html)
- Removed duplicate navigation, footer, theme toggle code (now in includes)

**Data-Driven Content:**
- Work experience (5 positions) → _data/en.yml and _data/id.yml
- Skills (4 categories) → data files
- Achievements (15 items) → data files
- Articles (4 pieces) → data files
- Education, courses, certifications → data files

**Bilingual Setup:**
- Single template set serves both languages
- page.lang determines which data file to use (en.yml or id.yml)
- Language switcher via permalink_en and permalink_id in front matter
- Breadcrumb navigation dynamically adjusts per page

**Cache Busting:**
- Centralized asset versioning: site.asset_version in _config.yml
- Currently set to: 202603251700
- Update once, applies to all CSS/JS references

### File Structure

```
/
├── _config.yml              # Jekyll configuration, asset_version
├── _data/
│   ├── en.yml              # English content
│   ├── id.yml              # Indonesian content
│   ├── meta.yml            # SEO metadata, GA ID
│   └── schema_person.json  # Person JSON-LD schema
├── _includes/
│   ├── head.html           # Complete HEAD section
│   ├── navigation.html     # Breadcrumb + language switcher
│   ├── language-switcher.html  # Language toggle component
│   ├── theme-toggle.html   # Dark/light mode button
│   ├── footer.html         # Footer with dynamic year
│   └── schema-person.html  # Person schema include
├── _layouts/
│   ├── default.html        # Base layout (head, body, scripts)
│   ├── page.html           # Standard page layout
│   ├── article.html        # Article layout (not used yet)
│   └── faq.html            # FAQ layout (created but not used)
├── index.html              # English portfolio (Jekyll template)
├── id.html                 # Indonesian portfolio (Jekyll template)
├── faq.html                # English FAQ (Jekyll template)
├── faq-id.html             # Indonesian FAQ (Jekyll template)
├── skills.html             # English skills (Jekyll template)
├── skills-id.html          # Indonesian skills (Jekyll template)
├── short.html              # Short English resume (Jekyll template)
├── short-id.html           # Short Indonesian resume (Jekyll template)
└── 404.html                # Error page (Jekyll template)
```

### Backup Files

All original HTML files backed up with .backup extension:
- index.html.backup
- id.html.backup
- faq.html.backup
- faq-id.html.backup
- skills.html.backup
- skills-id.html.backup
- short.html.backup
- short-id.html.backup
- 404.html.backup

## Testing Requirements

### Local Testing

**Ruby Version Required:** 3.0+ (current system has 2.6.10)

Options for local testing:
1. **Install rbenv and Ruby 3.3.0:**
   ```bash
   brew install rbenv
   rbenv install 3.3.0
   rbenv local 3.3.0
   bundle install
   bundle exec jekyll serve
   ```

2. **Use Docker:**
   ```bash
   docker run --rm -v "$PWD":/usr/src/app -p 4000:4000 jekyll/jekyll jekyll serve
   ```

3. **Skip local build, test on GitHub Pages:**
   - Push to GitHub
   - GitHub Pages automatically builds with correct Ruby version
   - View at https://adiputera.github.io/

### GitHub Pages Deployment

The site is already configured for GitHub Pages:
- ✅ Gemfile with github-pages gem
- ✅ _config.yml with GitHub Pages-compatible settings
- ✅ .gitignore excludes _site/, .jekyll-cache/, .sass-cache/
- ✅ .ruby-version file specifies 3.3.0

To deploy:
```bash
git add .
git commit -m "Convert to Jekyll: Phase 4 complete"
git push origin main
```

GitHub Pages will automatically build and deploy.

### What to Test

1. **Main portfolio pages:**
   - https://adiputera.github.io/ (English)
   - https://adiputera.github.io/id (Indonesian)
   - Verify work experience, skills, achievements display correctly
   - Test language switcher

2. **FAQ pages:**
   - https://adiputera.github.io/faq (English)
   - https://adiputera.github.io/faq-id (Indonesian)
   - Verify Q&A content, breadcrumb navigation

3. **Skills pages:**
   - https://adiputera.github.io/skills (English)
   - https://adiputera.github.io/skills-id (Indonesian)

4. **Theme toggle:** Dark/light mode switching works

5. **PWA functionality:** Service worker, offline capabilities

6. **SEO validation:**
   - View source, check Person JSON-LD schema
   - Verify meta tags, Open Graph, Twitter Cards
   - Check hreflang alternates

## Next Steps

After Phase 4 completion:

**Phase 5: Articles Collection** (6 tasks)
- Convert article HTML files to Markdown
- Set up _articles/ directory as Jekyll collection
- Create article layout template
- Add article frontmatter
- Test article pages
- Update article links

**Phase 6: PWA & Assets** (3 tasks)
- Verify service worker (sw.js) compatibility
- Test manifest.json
- Validate PWA icons

**Phase 7: Testing & Validation** (7 tests)
- Local build test
- GitHub Pages deployment test
- All pages rendering correctly
- Bilingual content accuracy
- SEO metadata validation
- PWA functionality check
- Cross-browser testing

## Maintenance Notes

### Updating Content

To update portfolio content:
1. Edit `_data/en.yml` or `_data/id.yml`
2. Commit and push to GitHub
3. GitHub Pages rebuilds automatically

### Adding New Work Experience

In `_data/en.yml`:
```yaml
experience:
  - title: "New Role"
    company: "Company Name"
    logo: "images/company-logo.svg"
    start_date: "2026-01"
    start_display: "Jan 2026"
    end_date: null
    end_display: "Present"
    description_html: |
      <p>Description here...</p>
```

Mirror the same structure in `_data/id.yml` with Indonesian translations.

### Updating Asset Version

When CSS/JS files change:
1. Edit `_config.yml`
2. Update `asset_version: "202603251700"` to new timestamp
3. All pages automatically use new version

### Schema Updates

To update Person JSON-LD:
1. Edit `_data/schema_person.json`
2. Changes apply to all pages automatically

## Known Limitations

1. **Local build requires Ruby 3.0+** - Current system has Ruby 2.6.10
2. **Article pages not yet migrated** - Still in Phase 5  
3. **Some page-specific schemas inline** - FAQ and skills pages have additional JSON-LD schemas that could be extracted to data files in future refactoring

## Success Metrics

✅ All 9 core pages converted to Jekyll
✅ ~300 lines of duplicate schema eliminated per page
✅ Bilingual content fully separated into data files
✅ Single source of truth for content updates
✅ Centralized asset versioning
✅ Reusable component includes (head, navigation, footer, theme-toggle)
✅ Backup files preserved for rollback if needed
