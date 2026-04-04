# How to Run Jekyll Site Locally

This guide walks you through installing all prerequisites and running the Jekyll portfolio site on your local machine.

---

## What You Need to Install

1. **Homebrew** - macOS package manager (if not already installed)
2. **Ruby 3.3** - Programming language (Jekyll requires Ruby 3.x, NOT Ruby 4.x)
3. **Bundler** - Ruby dependency manager
4. **Jekyll & Dependencies** - Static site generator and related gems

---

## Installation Steps

### Step 1: Check if Homebrew is Installed

```bash
brew --version
```

**If you see a version number**, Homebrew is already installed. Skip to Step 2.

**If you see "command not found"**, install Homebrew:

```bash
/bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
```

Follow the on-screen instructions to complete installation.

---

### Step 2: Install Ruby 3.1

```bash
brew install ruby@3.1
```

This installs Ruby 3.1 (compatible with Jekyll 3.9.0 and Liquid 4.0.3). Ruby 3.2+ and Ruby 4.0+ are NOT compatible due to removed `tainted?` method.

---

### Step 3: Configure Ruby 3.1 as Default

Add Ruby 3.1 to your shell PATH:

```bash
echo 'export PATH="/usr/local/opt/ruby@3.1/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

**Verify the installation:**

```bash
ruby --version
```

**Expected output:** `ruby 3.1.x` (e.g., `ruby 3.1.7`)

**Note:** If you still see Ruby 3.3.x or 4.x, restart your terminal and run `ruby --version` again.

---

### Step 4: Install Bundler

```bash
gem install bundler
```

**Verify:**

```bash
bundle --version
```

---

### Step 5: Install Jekyll and All Dependencies

Navigate to the project directory:

```bash
cd /Users/adiputera/master_git/adiputera.github.io
```

Install all required gems from the Gemfile:

```bash
bundle install
```

This installs:
- Jekyll 3.9.0 (via github-pages gem)
- All required plugins and dependencies

**This may take 2-5 minutes** depending on your internet connection.

---

## Running the Site

### Build the Site

Generate static files in the `_site/` directory:

```bash
bundle exec jekyll build
```

### Start the Development Server

Run with live reload (auto-refresh browser on file changes):

```bash
bundle exec jekyll serve --livereload
```

**Expected output:**

```
Configuration file: /Users/adiputera/master_git/adiputera.github.io/_config.yml
            Source: /Users/adiputera/master_git/adiputera.github.io
       Destination: /Users/adiputera/master_git/adiputera.github.io/_site
      Generating... 
                    done in X.XXX seconds.
 Auto-regeneration: enabled
LiveReload address: http://127.0.0.1:35729
    Server address: http://127.0.0.1:4000
  Server running... press ctrl-c to stop.
```

### Open the Site in Your Browser

Visit:
```
http://localhost:4000
```

**What you should see:**
- Your portfolio homepage
- Work experience from `_data/en.yml`
- Navigation menu
- Language switcher (EN/ID)
- Theme toggle (light/dark mode)

---

## Testing Live Reload

1. Keep the Jekyll server running
2. Open `_data/en.yml` in a text editor
3. Make a small change (e.g., edit a job title)
4. Save the file
5. Watch your browser automatically refresh with the changes!

---

## Stopping the Server

Press `Ctrl+C` in the terminal where Jekyll is running.

---

## Daily Workflow

Once everything is installed, your typical workflow is:

```bash
# 1. Navigate to project
cd /Users/adiputera/master_git/adiputera.github.io

# 2. Start server with live reload
bundle exec jekyll serve --livereload

# 3. Open http://localhost:4000 in browser

# 4. Edit content files:
#    - _data/en.yml (English content)
#    - _data/id.yml (Indonesian content)
#    - _articles/*.md (Articles)

# 5. Save files → browser auto-refreshes

# 6. Stop server when done: Ctrl+C
```

---

## Common Commands

```bash
# Build site only (no server)
bundle exec jekyll build

# Serve without live reload
bundle exec jekyll serve

# Serve on different port
bundle exec jekyll serve --port 4001

# Clean build artifacts
bundle exec jekyll clean

# Check for errors
bundle exec jekyll doctor

# Validate YAML files
ruby -ryaml -e "YAML.load_file('_data/en.yml')"
ruby -ryaml -e "YAML.load_file('_data/id.yml')"
```

---

## Troubleshooting

### Issue: Ruby version still shows 3.3.x or 4.x

**Solution:**
```bash
# Reload shell configuration
source ~/.zshrc

# Verify PATH includes Ruby 3.1
echo $PATH | grep ruby@3.1

# If not found, manually add to PATH:
export PATH="/usr/local/opt/ruby@3.1/bin:$PATH"
```

### Issue: "Port 4000 already in use"

**Solution:**
```bash
# Find and kill process using port 4000
lsof -ti:4000 | xargs kill -9

# Or use a different port
bundle exec jekyll serve --port 4001
```

### Issue: "Could not find gem 'github-pages'"

**Solution:**
```bash
# Ensure you're in the project directory
cd /Users/adiputera/master_git/adiputera.github.io

# Reinstall dependencies
bundle install
```

### Issue: Changes not appearing

**Solution:**
```bash
# Stop server (Ctrl+C)
bundle exec jekyll clean
bundle exec jekyll serve --livereload
```

### Issue: CSS/JS not updating despite changes

**Solution:**
After editing `src/master.css` or `src/index.js`:

1. Minify the files:
   ```bash
   # Install minification tools if needed
   npm install -g clean-css-cli uglify-js
   
   # Minify CSS
   cleancss -o src/master.min.css src/master.css
   
   # Minify JS
   uglifyjs src/index.js -c -m -o src/index.min.js
   ```

2. Update cache-busting version in `_config.yml`:
   ```yaml
   asset_version: "202604051400"  # Current timestamp
   ```

3. Rebuild:
   ```bash
   bundle exec jekyll clean
   bundle exec jekyll build
   ```

---

## Verification Checklist

After setup, verify:

- [ ] `ruby --version` shows `3.1.x`
- [ ] `bundle --version` works
- [ ] `bundle exec jekyll -v` shows Jekyll `3.9.x`
- [ ] Site loads at `http://localhost:4000`
- [ ] Homepage displays work experience
- [ ] Articles page loads
- [ ] Language switcher works (EN ↔ ID)
- [ ] Theme toggle works (light ↔ dark)
- [ ] Live reload works (save file → browser refreshes)

---

## Next Steps

Once the site is running:

1. **Learn Content Management**: Read [CONTENT_MANAGEMENT.md](CONTENT_MANAGEMENT.md)
2. **Update Your Content**:
   - Edit work experience in `_data/en.yml` and `_data/id.yml`
   - Add new articles in `_articles/`
   - Update skills and achievements
3. **Test Before Deploying**: Read [TESTING.md](TESTING.md)
4. **Deploy to GitHub Pages**:
   ```bash
   git add .
   git commit -m "Update content"
   git push origin main
   # GitHub Pages auto-deploys in ~2 minutes
   ```

---

## Alternative: Using Docker

If you prefer not to install Ruby locally, you can use Docker:

```bash
# Run Jekyll in Docker container
docker run -it --rm \
  -v "$PWD":/site \
  -p 4000:4000 \
  ruby:3.1 bash

# Inside container:
cd /site
gem install bundler
bundle install
bundle exec jekyll serve --host 0.0.0.0
```

Visit `http://localhost:4000`

---

## Quick Setup Command Summary

Copy and paste all commands:

```bash
# Install Ruby 3.1
brew install ruby@3.1

# Add to PATH
echo 'export PATH="/usr/local/opt/ruby@3.1/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

# Verify
ruby --version

# Navigate to project
cd /Users/adiputera/master_git/adiputera.github.io

# Install Bundler
gem install bundler

# Install dependencies
bundle install

# Start server
bundle exec jekyll serve --livereload

# Open http://localhost:4000
```

---

## Resources

- **Jekyll Documentation**: https://jekyllrb.com/docs/
- **GitHub Pages**: https://docs.github.com/en/pages
- **Ruby Documentation**: https://www.ruby-lang.org/en/documentation/
- **Bundler Guide**: https://bundler.io/guides/getting_started.html

---

**Questions?** Check [CONTENT_MANAGEMENT.md](CONTENT_MANAGEMENT.md), [TESTING.md](TESTING.md), or [CLAUDE.md](CLAUDE.md) for more details.
