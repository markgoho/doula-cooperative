# AGENTS.md

**Note:** See root `AGENTS.md` for monorepo-wide guidance. This file covers Hugo-specific patterns.

## OVERVIEW

Static site for Rochester Doula Cooperative. Hugo extended v0.129.0+, SCSS, doula directory with 59 profiles, integrated with Firebase Functions for forms.

## STRUCTURE

```
hugo/
├── content/
│   ├── doulas/           # 59 doula profiles (page bundles)
│   ├── faq/              # FAQ pages
│   └── *.md              # Top-level pages
├── layouts/
│   ├── _default/         # Base templates
│   ├── doulas/           # Profile templates
│   ├── partials/         # Reusable components
│   └── index.html        # Homepage template
├── assets/
│   ├── scss/             # Component-based SCSS
│   └── ts/               # Form handlers (contact, doula-match)
└── static/               # Favicons, robots.txt
```

## WHERE TO LOOK

| Task              | Location                                                  | Notes                                  |
| ----------------- | --------------------------------------------------------- | -------------------------------------- |
| Add doula profile | `content/doulas/<slug>/index.md`                          | Use `hugo new` command                 |
| Edit homepage     | `layouts/index.html`                                      | Landing page template                  |
| Form handlers     | `assets/ts/contact-us-form.ts`, `doula-match-form.ts`     | TypeScript, POST to Firebase Functions |
| Profile card      | `partials/profile-card.html`                              | Reusable doula card component          |
| Styles            | `assets/scss/`                                            | Component-based, page-specific files   |
| Navigation        | `partials/find-a-doula-nav.html`, `hugo.toml` menu config |                                        |
| Images            | `content/doulas/<slug>/`                                  | AVIF + JPG, 300/600/1200px widths      |

## COMMANDS

```bash
cd hugo

# Development
hugo server --disableFastRender -D    # Dev server with drafts (localhost:1313)
hugo server                           # Dev server without drafts

# Build
hugo                                  # Production build → public/
hugo --minify                         # Minified production build

# Content
hugo new content/doulas/<slug>/index.md   # Create new doula profile

# Search index (run from root)
bun run build:search                  # Hugo build + Pagefind index
```

## CONVENTIONS

### Content Organization

- **Doula profiles:** Page bundles under `content/doulas/<slug>/` with `index.md` + images
- **Top-level pages:** Single markdown files in `content/` (about, contact, join)
- **Taxonomies:** Tags (`tags: ["Birth Doula", "Postpartum Doula"]`) for specialties

### Required Front Matter (Doulas)

```yaml
title: Doula Name
credentials: Certifications/qualifications
tags: ["Birth Doula", "Postpartum Doula"]
contact:
  website: https://example.com
  phone: "+1-555-0123"
  email: doula@example.com
```

### Image Optimization

- Use `convert-images-to-avif.ts` or `convert-single-to-avif.ts` scripts
- Generate 300px, 600px, 1200px widths in AVIF + JPG formats
- Responsive delivery via Hugo's image processing

### SCSS Organization

- Component-based: `landing-page.scss`, `doula-profile.scss`, `find-a-doula.scss`
- Page-specific CSS inlined via `{{ define "head-styles" }}` pattern
- Use CSS custom properties for colors/spacing

### Forms → Firebase Functions

- Contact form: `assets/ts/contact-us-form.ts` → POST `/api/contact-us-form`
- Doula match: `assets/ts/doula-match-form.ts` → POST `/api/doula-match-form`
- reCAPTCHA v3 integration (`hugo.toml` has site key)

## ANTI-PATTERNS (THIS PROJECT)

- **DO NOT** create generic sections - use specific content types (doulas, faq)
- **DO NOT** hardcode Stripe keys in HTML - use environment variables via `hugo.toml` security.funcs
- **NEVER** commit unoptimized images - run AVIF conversion scripts first
- **NEVER** use inline styles - use SCSS files and Hugo's asset pipeline

## UNIQUE STYLES

- **Doula profiles managed via GitHub App:** Functions read/write profiles from GitHub, not Firestore
- **Page-specific CSS inlined:** Uses `{{ define "head-styles" }}` with SCSS partial includes
- **Hugo + Firebase integration:** Static site with serverless backend for forms/auth
- **Pagefind search:** Generated post-build with `bunx pagefind --site hugo/public`

## NOTES

### Hugo Version

- Requires Hugo **extended** >= 0.129.0 (SCSS processing)
- Check version: `hugo version`

### Environment Variables

- `STRIPE_PUBLISHABLE_KEY`, `STRIPE_PRICING_TABLE_ID`, `STRIPE_MODE` for checkout
- Access via `getenv` in templates (allowed in `hugo.toml` security.funcs)

### Deployment

- Production: `hugo --minify` → Firebase Hosting (`main-site` target)
- PR previews: GitHub Actions build + Firebase preview channels
- Post-deploy webhook: Notifies Functions of profile changes

### Profile Workflow

1. Create profile: `hugo new content/doulas/<slug>/index.md`
2. Add images (optimized AVIF/JPG in profile directory)
3. Edit front matter + bio content
4. Deploy → profile-deployment-webhook triggers via GitHub Actions

### Verify Changes

- Use Playwright MCP server to browse and verify Hugo changes in browser
- Forms should work in dev with emulators or mocked responses
