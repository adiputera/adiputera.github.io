# Jekyll Migration Testing Checklist

## Overview
This document outlines testing procedures to verify the Jekyll migration is working correctly.

## Ruby Version Requirement
⚠️ **IMPORTANT**: Jekyll 3.9.0 requires Ruby 3.x (current system has Ruby 4.0.2 which is incompatible)

### Option 1: Install Ruby 3.3 via Homebrew
```bash
brew install ruby@3.3
echo 'export PATH="/opt/homebrew/opt/ruby@3.3/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
ruby --version  # Should show 3.3.x
```

### Option 2: Use Docker
```bash
docker run -it --rm -v "$PWD":/site -p 4000:4000 ruby:3.3 bash
cd /site
bundle install
bundle exec jekyll serve --host 0.0.0.0
```

### Option 3: Test on GitHub Pages directly
Push to GitHub and let GitHub Pages build it in the cloud (no local testing needed).

---

## Phase 8: Testing & Verification Checklist

### Test 1: YAML Data Validation ✅
**Status**: Already validated during migration

**Commands**:
```bash
ruby -ryaml -e "YAML.load_file('_data/en.yml')"
ruby -ryaml -e "YAML.load_file('_data/id.yml')"
ruby -ryaml -e "YAML.load_file('_data/meta.yml')"
ruby -ryaml -e "YAML.load_file('_data/schema_person.json')"  # JSON validation
```

**Expected**: No syntax errors

---

### Test 2: Jekyll Build
**Command**:
```bash
bundle exec jekyll build
```

**Expected output**:
- No errors
- `_site/` directory created
- All HTML files generated (index.html, id.html, faq.html, faq-id.html, skills.html, skills-id.html, short.html, short-id.html, 404.html)
- Articles generated at `_site/articles/*.html`
- Sitemap generated at `_site/sitemap.xml`

**Check file count**:
```bash
ls -1 _site/*.html | wc -l   # Should be 9 HTML files
ls -1 _site/articles/*.html | wc -l  # Should be 4 article files
```

---

### Test 3: Local Server
**Command**:
```bash
bundle exec jekyll serve --livereload
```

**Expected**:
- Server runs on http://localhost:4000
- No build errors
- Live reload working

**Manual checks**:
- Visit http://localhost:4000/ — English homepage loads
- Visit http://localhost:4000/id — Indonesian homepage loads
- All content displays correctly

---

### Test 4: Bilingual Switching
**Pages to test**:
- http://localhost:4000/ ↔ http://localhost:4000/id
- http://localhost:4000/faq ↔ http://localhost:4000/faq-id
- http://localhost:4000/skills ↔ http://localhost:4000/skills-id
- http://localhost:4000/short ↔ http://localhost:4000/short-id

**What to check**:
1. Language switcher button visible in header
2. Clicking language toggle switches between EN/ID correctly
3. Content changes to correct language
4. No broken layouts after switching

---

### Test 5: Content Rendering
**Homepage (index.html / id.html)**:
- [ ] Photo displays (images/photo.webp)
- [ ] Work experience section renders (5 jobs from _data/en.yml or id.yml)
- [ ] Skills section renders (backend, frontend, cloud, database categories)
- [ ] Achievements section renders (15 items)
- [ ] Technical articles section renders (4 articles)
- [ ] Education section renders

**FAQ pages (faq.html / faq-id.html)**:
- [ ] All FAQ sections render
- [ ] Accordion/collapsible sections work
- [ ] No HTML rendering issues

**Skills pages (skills.html / skills-id.html)**:
- [ ] All skill categories display
- [ ] Article cards render correctly

**Articles (_articles/*.md)**:
- [ ] http://localhost:4000/articles/remote-debug-sap-commerce
- [ ] http://localhost:4000/articles/enable-image-upload-backoffice
- [ ] http://localhost:4000/articles/install-plugins-backoffice
- [ ] http://localhost:4000/articles/sap-commerce-sso-bcrypt-error

**For each article check**:
- [ ] Title displays correctly
- [ ] Date displays (e.g., "March 2, 2026")
- [ ] Breadcrumb navigation: Home > Articles > [Title]
- [ ] Markdown converted to HTML properly
- [ ] Code blocks render with syntax highlighting
- [ ] Images display correctly
- [ ] Canonical link footer present

---

### Test 6: PWA Functionality
**Service Worker**:
```bash
# Check _site/sw.js exists
ls -la _site/sw.js
```

**Browser DevTools**:
1. Open http://localhost:4000
2. Open DevTools → Application tab
3. Check "Service Workers" — should show registered worker
4. Check "Manifest" — should show PWA manifest details
5. Test offline: Stop server, refresh page — should still load cached content

**Icons check**:
```bash
ls -la _site/images/*.png
```
Expected: 128.png, 192.png, 256.png, 384.png, 512.png, 512-maskable.png

---

### Test 7: SEO & Metadata
**Sitemap validation**:
```bash
# Visit sitemap
curl http://localhost:4000/sitemap.xml | head -50
curl http://localhost:4000/sitemap.txt
```

**Expected in sitemap.xml**:
- All 8 main pages (index, id, faq, faq-id, skills, skills-id, short, short-id)
- All 4 articles
- Proper XML structure with <url>, <loc>, <lastmod>
- hreflang tags for bilingual pages

**Expected in sitemap.txt**:
- Plain text list of all URLs
- 12 URLs total (8 pages + 4 articles)

**robots.txt**:
```bash
curl http://localhost:4000/robots.txt
```

**Expected**:
- Allows all crawlers
- Disallows Jekyll internals (_data, _includes, _layouts)
- Points to sitemap.xml

**JSON-LD Schema validation**:
1. Visit http://localhost:4000/
2. View page source
3. Check for Person JSON-LD schema in <head>
4. Visit http://localhost:4000/articles/remote-debug-sap-commerce
5. Check for Article + BreadcrumbList JSON-LD schema

**Validate with Google's Rich Results Test**:
- https://search.google.com/test/rich-results
- Enter URLs and validate structured data

---

### Test 8: CSS & JavaScript Loading
**Visual inspection**:
- [ ] Dark/light theme toggle works
- [ ] Styles load correctly (no unstyled content flash)
- [ ] Responsive design works (mobile, tablet, desktop)

**DevTools Network tab**:
- [ ] CSS loads: `src/master.min.css?v=202603251700`
- [ ] JS loads: `src/index.min.js?v=202603251700`
- [ ] No 404 errors for assets
- [ ] Service worker registers successfully

**Asset versioning check**:
```bash
# Check HTML files reference versioned assets
grep "asset_version" _site/index.html
```
Expected: `?v=202603251700` in CSS/JS URLs

---

### Test 9: Internal Links
**Navigation links**:
- [ ] Header logo links to homepage
- [ ] Language switcher works
- [ ] All navigation menu items work

**Content links**:
- [ ] Article links from homepage go to /articles/[slug]
- [ ] Breadcrumb links work (Home, Articles)
- [ ] Footer links work

**Check for broken links**:
```bash
# Build site first
bundle exec jekyll build

# Use htmlproofer (install if needed)
gem install html-proofer
htmlproofer ./_site --disable-external --allow-hash-href
```

---

## Migration Comparison

### Before (Static HTML)
- **9 HTML pages**: ~35KB each with duplicated HEAD sections
- **4 HTML articles**: ~40KB each with full HEAD duplication
- **Static sitemap**: Manual updates required
- **Person JSON-LD**: Duplicated across all pages (~300 lines × 9 = 2700 lines)
- **Bilingual**: Separate files for each language

### After (Jekyll)
- **9 Jekyll pages**: ~6KB each (83% reduction)
- **4 Markdown articles**: ~3KB each (92% reduction)
- **Dynamic sitemap**: Auto-generated from collections
- **Person JSON-LD**: Single source (_data/schema_person.json)
- **Bilingual**: Single templates + _data/en.yml + _data/id.yml
- **Total duplication eliminated**: ~4000+ lines

---

## Post-Migration Cleanup (Optional)

After successful testing, you can remove backup files:

```bash
# List all backup files first
find . -name "*.backup" -type f

# Remove backups (BE CAREFUL!)
find . -name "*.backup" -type f -delete
```

**Backup files created during migration**:
- `index.html.backup`
- `id.html.backup`
- `faq.html.backup`
- `faq-id.html.backup`
- `skills.html.backup`
- `skills-id.html.backup`
- `short.html.backup`
- `short-id.html.backup`
- `404.html.backup`
- `sitemap.xml.backup`
- `sitemap.txt.backup`

---

## GitHub Pages Deployment

Once local testing passes, deploy to GitHub Pages:

```bash
git add .
git commit -m "Complete Jekyll migration with dynamic content management"
git push origin main
```

**GitHub Pages will automatically**:
- Build with Jekyll 3.9.0
- Use Ruby 3.x environment (compatible)
- Deploy to https://adiputera.github.io/
- No build configuration needed (github-pages gem handles it)

**Check deployment status**:
- Go to https://github.com/adiputera/adiputera.github.io/actions
- Monitor build logs
- Verify site at https://adiputera.github.io/ after ~2 minutes

---

## Troubleshooting

### Issue: Ruby 4.0 incompatibility
**Solution**: Use Ruby 3.3 or Docker or GitHub Pages cloud build

### Issue: Bundle install fails
**Solution**: Delete Gemfile.lock and run `bundle install` again

### Issue: Jekyll build errors
**Solution**: Check YAML syntax in _data files
```bash
ruby -ryaml -e "YAML.load_file('_data/en.yml')"
```

### Issue: Articles not rendering
**Solution**: Check _config.yml collections configuration
```yaml
collections:
  articles:
    output: true
    permalink: /articles/:title/
```

### Issue: Styles not loading
**Solution**: Check asset_version in _config.yml and verify paths in _includes/head.html

### Issue: Service worker not registering
**Solution**: Check sw.js file permissions and browser console for errors

---

## Success Criteria ✅

Migration is successful when:
- [ ] Jekyll builds without errors
- [ ] All 9 pages render correctly
- [ ] All 4 articles display properly
- [ ] Bilingual switching works
- [ ] PWA functionality intact
- [ ] SEO schemas validated
- [ ] No broken links
- [ ] Assets load with versioning
- [ ] GitHub Pages deployment succeeds

---

## Next Steps

After successful testing:
1. **Remove backup files** (optional cleanup)
2. **Update README.md** with Jekyll instructions
3. **Document content management workflow** (how to add new articles, update content)
4. **Consider GitHub Actions** for automated testing on push

---

## Questions?

Check CLAUDE.md for architecture details and development workflow.
