# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a Hugo static site for the Rochester Doula Cooperative (https://doulacooperative.com/). The site connects families with professional birth and postpartum doulas in the Rochester, NY area.

## Commands

### Development
```bash
# Start Hugo development server (run from hugo/ directory)
hugo server

# Start with drafts visible
hugo server -D

# Build the site for production
hugo

# Create new content
hugo new content/doulas/doula-name/index.md
```

### Requirements
- Hugo extended version >= 0.129.0 (specified in hugo.toml)
- The extended version is required for SCSS/Sass processing

## Architecture

### Content Structure

**Doula Profiles**: Each doula has a directory under `content/doulas/` with:
- `index.md` - Profile metadata and bio
- Multiple optimized images (AVIF and JPG formats at 300px, 600px, 1200px widths)
- Front matter includes: `title`, `credentials`, `tags`, `contact` (website, phone, email)

**Content Organization**:
- Landing page: `content/_index.md` (rendered by `layouts/index.html`)
- Static pages use `content/{section}/_index.md` pattern
- Custom layouts per section in `layouts/{section}/`

### Template System

**Base Template**: `layouts/_default/baseof.html` defines the core structure:
- Uses block system for extensibility (`hero`, `header`, `main`, `footer`, `head-styles`, `head-scripts`, `footer-scripts`)
- Head partials split into: `site.html`, `critical-css.html`, `non-critical-css.html`, `analytics.html`
- Includes OpenGraph meta tags via `partial "opengraph.html"`

**Template Hierarchy**:
- `layouts/index.html` - Homepage with hero section and navigation cards
- `layouts/_default/single.html` - Individual content pages
- `layouts/_default/list.html` - List/archive pages
- Section-specific layouts in `layouts/{section}/` directories

**Partials**:
- `partials/header.html` - Site header and navigation
- `partials/footer.html` - Site footer
- `partials/head/` - Modular head components
- `partials/profile-card.html` - Doula profile card component
- `partials/find-a-doula-nav.html` - Find-a-doula navigation
- `partials/json-ld.html` - Structured data

### Asset Pipeline

**SCSS Organization**: Component-based structure in `assets/scss/`:
- `base.scss` - CSS reset (Andy Bell's Modern CSS Reset 2024)
- Page-specific: `landing-page.scss`, `doula-profile.scss`, `find-a-doula.scss`, etc.
- `colors.scss` - Color system with CSS custom properties
- `button.scss` - Button components
- `components/` - Reusable component styles

**Processing**: SCSS compiled via Hugo Pipes with Dart Sass:
```go
{{ $options := (dict "transpiler" "dartsass" "outputStyle" "compressed") }}
{{ $inlineCSS := resources.Get $pageCSS | css.Sass $options }}
```

Critical CSS is inlined in `<head>`, non-critical CSS loaded separately.

**TypeScript**: Located in `assets/ts/`:
- `contact-us-form.ts` - Contact form handling
- `doula-match-form.ts` - Doula matching form logic

### Performance Optimizations

- **Image Optimization**: Multiple responsive AVIF images with JPG fallbacks (300px, 600px, 1200px)
- **CSS Strategy**: Critical CSS inlined, non-critical loaded separately
- **Preloading**: Hero images preloaded with media queries for responsive delivery
- **View Transitions API**: Configured in CSS reset for smooth page transitions

### Configuration (hugo.toml)

Key settings:
- `enableRobotsTXT = true` - SEO configuration
- `enableGitInfo = true` - Git-based lastmod dates
- Front matter lastmod priority: `:git`, `lastmod`, `:fileModTime`, `date`, `publishDate`
- Taxonomies: `tags` used for doula specialties
- Permalinks: `/doulas/tag/:slug/` for tag pages
- Menu defined in config for main navigation

## Reference Documentation

The `DIRECTORY_STRUCTURE.md` file is the authoritative living architecture documentation, maintained as part of PBI 017. It includes:
- Detailed directory structure with Mermaid diagrams
- Backlog-driven structure recommendations
- Content type specifications
- Hugo best practices

## Working with Doula Profiles

When creating or modifying doula profiles:
1. Each doula gets a directory: `content/doulas/{slug}/`
2. Required files: `index.md` and profile images
3. Required front matter fields: `title`, `credentials`, `tags`, `contact`
4. Tags define specialties (e.g., "Birth Doula", "Postpartum Doula")
5. Images should be optimized in multiple formats/sizes
