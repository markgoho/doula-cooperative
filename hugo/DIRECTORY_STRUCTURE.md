# Hugo Directory and File Structure Guide

This document outlines the recommended directory and file structure for the Hugo static site in this project, based on Hugo best practices and the specific needs of the Doula Cooperative website.

## Overview

This Hugo site follows the standard Hugo directory structure with some project-specific conventions. The structure is designed to be maintainable, scalable, and follow modern Hugo best practices.

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
├── README.md            # Project documentation
├── .hugo_build.lock     # Hugo build lock file (auto-generated)
└── DIRECTORY_STRUCTURE.md # This documentation file
```

## Recommended Complete Structure

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

*Last updated: January 28, 2025*
*Maintained as part of PBI 017: Hugo Site Architecture & Boilerplate*