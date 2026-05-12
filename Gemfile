source "https://rubygems.org"

# Built via GitHub Actions (Pages source = "GitHub Actions"), so we pin Jekyll
# and plugins directly instead of going through the github-pages meta-gem.
gem "jekyll", "~> 4.3"

group :jekyll_plugins do
  gem "jekyll-sitemap"
  gem "jekyll-redirect-from"
  gem "jekyll-paginate-v2"
end

# Required for Ruby 4.0+ (removed from stdlib)
gem "csv"
gem "bigdecimal"
gem "base64"
gem "logger"

# Optional: Windows and JRuby support
platforms :mingw, :x64_mingw, :mswin, :jruby do
  gem "tzinfo", ">= 1", "< 3"
  gem "tzinfo-data"
end

# Performance-booster for watching directories on Windows
gem "wdm", "~> 0.1", :platforms => [:mingw, :x64_mingw, :mswin]

# Lock `http_parser.rb` gem to `v0.6.x` on JRuby builds
gem "http_parser.rb", "~> 0.6.0", :platforms => [:jruby]
