# Hugo Directory and File Structure Guide

This document outlines the recommended directory and file structure for the Hugo static site in this project, based on Hugo best practices and the specific needs of the Doula Cooperative website.

## Overview

This Hugo site follows the standard Hugo directory structure with some project-specific conventions. The structure is designed to be maintainable, scalable, and follow modern Hugo best practices.

## Recommended Structure for Doula Cooperative (Backlog-Driven)

_This structure is derived directly from the current product backlog and should be updated as PBIs evolve._

```
hugo/
├── archetypes/
│   └── default.md
├── assets/
│   └── scss/
│       ├── styles.scss
│       └── non-critical.scss
├── content/
│   ├── _index.md                # Landing page
│   ├── about/
│   │   └── _index.md            # About the Cooperative
│   ├── about-doulas/
│   │   └── _index.md            # About Doulas, FAQ, types, fees
│   ├── doulas/
│   │   ├── _index.md            # Find a Doula (search/filter page)
│   │   └── jane-doe.md          # Example doula profile (slug = jane-doe)
│   ├── join/
│   │   └── _index.md            # Join the Cooperative
│   └── contact/
│       └── _index.md            # Contact Us
├── data/
│   ├── doulas.yaml              # List of doulas (if not using content files)
│   ├── board.yaml               # Board/team info
│   └── navigation.yaml          # Navigation structure
├── layouts/
│   ├── _default/
│   │   ├── baseof.html
│   │   ├── single.html
│   │   └── list.html
│   └── partials/
│       ├── header.html
│       ├── footer.html
│       ├── meta.html
│       └── ... (forms, social cards, etc.)
├── static/
│   ├── images/
│   │   └── ... (site images, logos, etc.)
│   ├── favicon.ico
│   └── robots.txt
├── hugo.toml
├── README.md
├── .hugo_build.lock
└── DIRECTORY_STRUCTURE.md
```

### Key Content Types and Pages

- **Landing Page**: `content/_index.md`
- **About the Cooperative**: `content/about/_index.md`
- **About Doulas**: `content/about-doulas/_index.md`
- **Find a Doula**: `content/doulas/_index.md`
- **Doula Profiles**: `content/doulas/{slug}.md` (or `data/doulas.yaml`)
- **Join the Cooperative**: `content/join/_index.md`
- **Contact Us**: `content/contact/_index.md`
- **Board/Team Data**: `data/board.yaml`
- **Navigation/Menu**: `data/navigation.yaml`

### Notes

- Only create folders/files that match the above structure for boilerplate.
- Do not create generic sections (e.g., services, resources, posts) unless a PBI requires them.
- For Doulas: Use either `content/doulas/{slug}.md` for each doula, or a single `data/doulas.yaml` if you want to manage them as data.
- For navigation, board/team, etc.: Use `data/` files.
- For static pages: Use `content/{section}/_index.md`.

---

## Recommended Complete Structure (Generic Hugo Best Practices)

_The following is a generic best-practice structure for Hugo sites. For this project, use the backlog-driven structure above as your primary reference._

Based on Hugo best practices, the following directories should be added as the site grows:

```
hugo/
├── archetypes/          # ✅ CURRENT - Content blueprints
├── assets/              # ✅ CURRENT - Asset pipeline files
├── content/             # 📝 RECOMMENDED - Site content (Markdown files)
│   ├── _index.md           # Homepage content
│   ├── about/              # About section
│   │   └── index.md
│   ├── services/           # Services pages
│   │   ├── _index.md
│   │   ├── birth-support.md
│   │   └── postpartum-care.md
│   ├── resources/          # Resources and blog posts
│   │   ├── _index.md
│   │   └── posts/
│   └── contact/            # Contact page
│       └── index.md
├── data/                # 📝 RECOMMENDED - Data files (YAML/JSON)
│   ├── navigation.yaml     # Site navigation structure
│   ├── services.yaml       # Service offerings data
│   └── team.yaml          # Team member information
├── i18n/                # 🔄 OPTIONAL - Translation files
│   ├── en.yaml             # English translations
│   └── es.yaml             # Spanish translations (if needed)
├── layouts/             # ✅ CURRENT - HTML templates
├── static/              # 📝 RECOMMENDED - Static files (copied as-is)
│   ├── images/             # Static images
│   │   ├── favicon.ico
│   │   ├── logo.png
│   │   └── og-image.jpg
│   ├── fonts/              # Web fonts (if not using CDN)
│   ├── robots.txt          # Search engine robots file
│   └── manifest.json       # Web app manifest
├── themes/              # 🔄 OPTIONAL - Hugo themes (if using external theme)
├── hugo.toml            # ✅ CURRENT - Site configuration
└── docs/                # 📝 RECOMMENDED - Project documentation
    ├── DIRECTORY_STRUCTURE.md
    ├── DEVELOPMENT.md
    └── DEPLOYMENT.md
```

## Current Directory Structure

```
hugo/
├── archetypes/          # Content blueprints and templates
│   └── default.md       # Default archetype for new content
├── assets/              # Files to be processed by Hugo Pipes
│   └── scss/            # Sass/SCSS stylesheets
│       ├── styles.scss      # Main stylesheet entry point
│       └── non-critical.scss # Non-critical styles for optimization
├── layouts/             # HTML templates
│   ├── _default/        # Default templates
│   │   ├── baseof.html     # Base template (main layout)
│   │   ├── list.html       # List page template
│   │   └── single.html     # Single page template
│   └── partials/        # Reusable template components
│       ├── head.html       # HTML head section
│       ├── header.html     # Site header
│       ├── footer.html     # Site footer
│       └── meta.html       # Meta tags and SEO
├── hugo.toml            # Main site configuration
├── README.md            # Project documentation (currently placeholder)
├── public/               # Build output (auto-generated, not versioned)
│   ├── index.html            # Site homepage (generated)
│   ├── index.xml             # Site feed (generated)
│   ├── sitemap.xml           # Sitemap (generated)
│   ├── non-critical.*.css    # Hashed CSS files (from assets)
│   ├── categories/           # Taxonomy pages (generated)
│   └── tags/                 # Taxonomy pages (generated)
├── resources/            # Asset pipeline cache (auto-generated, not versioned)
│   └── _gen/
│       └── assets/
│           └── scss/
│               ├── *.content     # Processed SCSS output (hashed)
│               └── *.json        # Asset pipeline metadata
├── .hugo_build.lock     # Hugo build lock file (auto-generated)
└── DIRECTORY_STRUCTURE.md # This documentation file
```

## Directory Descriptions

### Essential Directories (Current)

#### `archetypes/`

- **Purpose**: Templates for new content creation
- **Files**: `default.md` - Default front matter and content structure
- **Usage**: Used when creating new content with `hugo new`

#### `assets/`

- **Purpose**: Files processed by Hugo Pipes (Sass, JS, images for optimization)
- **Current**: Contains SCSS files for styling
- **Best Practice**: Use for files that need processing, compilation, or optimization

#### `layouts/`

- **Purpose**: HTML templates that define site structure and appearance
- **Structure**:
  - `_default/`: Base templates used by all content types
  - `partials/`: Reusable template components
- **Current Files**:
  - `baseof.html`: Main page wrapper template
  - `list.html`: Template for list pages (blog index, etc.)
  - `single.html`: Template for individual content pages
  - `head.html`: HTML head section with meta tags
  - `header.html`: Site header and navigation
  - `footer.html`: Site footer
  - `meta.html`: SEO and social media meta tags

#### `public/`

- **Purpose**: Build output directory generated by Hugo
- **Contents**: HTML, XML, CSS (with hashed filenames), taxonomy folders (e.g., `categories/`, `tags/`), and other static site output
- **Note**: Should not be versioned or manually edited; contents are regenerated on each build

#### `resources/`

- **Purpose**: Hugo asset pipeline cache (auto-generated)
- **Contents**: Processed assets (e.g., SCSS output, metadata) in hashed `.content` and `.json` files under `_gen/assets/`
- **Note**: Should not be versioned or manually edited

#### `.hugo_build.lock`

- **Purpose**: Lock file created by Hugo to manage build state
- **Note**: Auto-generated; safe to ignore for most workflows

### Recommended Additions

#### `content/`

- **Purpose**: All site content (Markdown files)
- **Structure**: Organized by content type and hierarchy
- **Required**: Essential for a functioning Hugo site
- **Convention**: Use `_index.md` for section pages, `index.md` for page bundles

#### `static/`

- **Purpose**: Files copied directly to the output without processing
- **Use For**: Images, fonts, favicons, robots.txt, manifest files
- **Structure**: Mirrors the desired output URL structure

#### `data/`

- **Purpose**: Data files (YAML, JSON, TOML) for dynamic content
- **Use For**: Navigation menus, team listings, service information
- **Benefit**: Separates data from templates for easier maintenance

### Optional Directories

#### `i18n/`

- **Purpose**: Translation files for multilingual sites
- **Use Case**: If supporting multiple languages
- **Structure**: One file per language (e.g., `en.yaml`, `es.yaml`)

#### `themes/`

- **Purpose**: External Hugo themes
- **Use Case**: Only if using or developing a theme
- **Current**: Not needed for custom-built sites

## File Naming Conventions

### Content Files

- Use lowercase with hyphens: `birth-support.md`
- Section indexes: `_index.md`
- Page bundles: `index.md` within a folder

### Template Files

- Use descriptive names: `header.html`, `navigation.html`
- Follow Hugo conventions: `baseof.html`, `list.html`, `single.html`

### Asset Files

- SCSS: Use meaningful names like `styles.scss`, `variables.scss`
- Images: Use descriptive names with appropriate file extensions

### Data Files

- Use clear, descriptive names: `navigation.yaml`, `services.yaml`
- Use consistent format (YAML recommended for readability)

## Configuration

### Main Configuration (`hugo.toml`)

- Contains site-wide settings
- Current basic setup should be expanded for production
- Consider environment-specific configurations for development/production

### Recommended Configuration Sections

```toml
baseURL = 'https://doulacooperative.org/'
languageCode = 'en-us'
title = 'Doula Cooperative'

[params]
  description = 'Supporting families through birth and beyond'
  author = 'Doula Cooperative'

[menu]
  # Define navigation menus

[markup]
  # Configure markdown processing

[server]
  # Development server settings
```

## Best Practices Summary

1. **Content Organization**: Use logical folder structure in `content/`
2. **Asset Processing**: Keep processable assets in `assets/`, static files in `static/`
3. **Template Modularity**: Use partials for reusable components
4. **Data Separation**: Use `data/` files for content that changes frequently
5. **Configuration**: Keep site configuration organized and environment-aware
6. **Documentation**: Maintain this structure guide as the site evolves

## Next Steps

1. Create missing directories (`content/`, `static/`, `data/`)
2. Add basic content files and structure
3. Implement navigation and data files
4. Update configuration for production use
5. Create development and deployment documentation

## References

- [Hugo Directory Structure Documentation](https://gohugo.io/getting-started/directory-structure/)
- [Hugo Content Organization](https://gohugo.io/content-management/organization/)
- [Hugo Configuration](https://gohugo.io/getting-started/configuration/)

---

_Last updated: January 28, 2025_
_Maintained as part of PBI 017: Hugo Site Architecture & Boilerplate_

## Boilerplate/Empty Files for Key Hugo Sections

The following files and directories should exist as boilerplate or empty files to establish the Hugo project structure:

- `content/` — Main directory for site content (should exist, even if empty)
- `layouts/` — Main directory for templates
  - `layouts/_default/` — Default templates (e.g., `baseof.html`, `list.html`, `single.html`)
  - `layouts/partials/` — Partial templates (e.g., `head.html`, `header.html`, `footer.html`, `meta.html`)
- `assets/` — Directory for asset files (e.g., SCSS, JS)
  - `assets/scss/` — SCSS source files (e.g., `styles.scss`, `non-critical.scss`)

> Each of these should be present in the repo, even if empty, to ensure Hugo recognizes the structure and to provide a starting point for future development.
