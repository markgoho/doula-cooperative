---
paths: hugo/**
---

# Hugo Site - Rochester Doula Cooperative

Project-specific guidance for the Hugo static site at https://doulacooperative.com/

**Note:** This file extends and overrides the generic Hugo best practices defined in `~/.claude/rules/hugo.md`. When working on this project, follow these project-specific patterns where they differ from the generic defaults. This file contains only project-specific details; refer to the user-level rules for general Hugo guidance.

## Project Overview

Hugo static site connecting families with professional birth and postpartum doulas in Rochester, NY area. Tech stack: Hugo (extended v0.129.0+), SCSS/Sass, TypeScript, Firebase Functions integration.

## Commands

- **Development:** `hugo server` or `hugo server -D` (with drafts) from `hugo/` directory
- **Production build:** `hugo` (outputs to public/)
- **New doula profile:** `hugo new content/doulas/doula-slug/index.md`
- **Requirements:** Hugo extended >= 0.129.0

## Content Structure

### Doula Profiles

Each doula profile is a page bundle under `content/doulas/` containing:

- `index.md` - Profile metadata and bio
- Multiple optimized images (AVIF and JPG formats at 300px, 600px, 1200px widths)

**Required front matter:**

```yaml
title: Doula Name
credentials: Certifications/qualifications
tags: ["Birth Doula", "Postpartum Doula"]  # Specialties
contact:
  website: https://example.com
  phone: "+1-555-0123"
  email: doula@example.com
```

### Key Project Partials

- `partials/profile-card.html` - Doula profile card component
- `partials/find-a-doula-nav.html` - Find-a-doula navigation
- `partials/head/` - Modular head components (site.html, critical-css.html, non-critical-css.html, analytics.html)

### Asset Files

**SCSS:** Component-based structure with page-specific files (landing-page.scss, doula-profile.scss, find-a-doula.scss, etc.)

**TypeScript:** Form handlers in `assets/ts/`:
- `contact-us-form.ts` - Contact form handling
- `doula-match-form.ts` - Doula matching form logic

### Configuration

**Taxonomies:** `tags` used for doula specialties

**Permalinks:** `/doulas/tag/:slug/` for tag pages

## Image Optimization Scripts

Use these project scripts to prepare profile images:

- `convert-images-to-avif.ts` - Batch convert directory
- `convert-single-to-avif.ts` - Convert single image

Both generate multiple sizes (300px, 600px, 1200px) in AVIF and JPG formats for responsive delivery.

## Firebase Integration

- Forms POST to Firebase Functions: `/api/contact-us-form`, `/api/doula-match-form`
- Functions read Hugo content from GitHub via Octokit
- Form handlers: `assets/ts/contact-us-form.ts`, `assets/ts/doula-match-form.ts`

## Reference Documentation

See `DIRECTORY_STRUCTURE.md` for detailed architecture (maintained as part of PBI 017)
