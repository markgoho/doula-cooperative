# Hugo Development Guide

Project-specific Hugo configuration and best practices for the Rochester Doula Cooperative site.

## Environment Variables

### How Hugo Reads Environment Variables

Hugo has special support for environment variables that override configuration values at build time.

**Key Rules:**
1. Environment variables must be prefixed with `HUGO_`
2. Underscores after the prefix represent **nesting levels**
3. Everything converts to **lowercase**
4. CamelCase is not preserved

### Naming Convention Examples

| Environment Variable | Becomes in Template | Notes |
|---------------------|---------------------|-------|
| `HUGO_PARAMS_APIKEY` | `.Site.Params.apikey` | Single level param |
| `HUGO_PARAMS_STRIPE_MODE` | `.Site.Params.stripe.mode` | One underscore = one nesting level |
| `HUGO_PARAMS_STRIPE_PUBLISHABLEKEY` | `.Site.Params.stripe.publishablekey` | All lowercase (not camelCase) |
| ❌ `HUGO_PARAMS_STRIPE_PUBLISHABLE_KEY` | `.Site.Params.stripe.publishable.key` | Two underscores = nested too deep! |

### Common Pitfall: Multiple Underscores

**Problem:**
```yaml
# In GitHub Actions workflow
env:
  HUGO_PARAMS_STRIPE_PUBLISHABLE_KEY: "pk_test_..."  # ❌ Wrong!
```

**Why it fails:**
- Hugo interprets this as: `.Site.Params.stripe.publishable.key` (3 levels deep)
- Template expects: `.Site.Params.stripe.publishableKey` (2 levels)
- Result: `publishableKey` is undefined

**Solution:**
```yaml
# In GitHub Actions workflow
env:
  HUGO_PARAMS_STRIPE_PUBLISHABLEKEY: "pk_test_..."  # ✅ Correct!
```

**In template:**
```html
{{ .Site.Params.stripe.publishablekey }}  <!-- lowercase! -->
```

### Testing Environment Variables Locally

```bash
# Test what Hugo sees
HUGO_PARAMS_STRIPE_PUBLISHABLEKEY="pk_test_ABC" hugo config | grep stripe

# Output shows:
# [params.stripe]
#   publishablekey = 'pk_test_ABC'
```

## Stripe Integration

### Environment-Based Configuration

The site uses environment variables to switch between test and production Stripe credentials:

**PR Previews** (`.github/workflows/hugo-hosting-pull-request.yml`):
```yaml
env:
  HUGO_PARAMS_STRIPE_PUBLISHABLEKEY: ${{ secrets.STRIPE_TEST_PUBLISHABLE_KEY }}
  HUGO_PARAMS_STRIPE_PRICINGTABLEID: ${{ secrets.STRIPE_TEST_PRICING_TABLE_ID }}
  HUGO_PARAMS_STRIPE_MODE: "test"
```

**Production** (`.github/workflows/hugo-hosting-merge.yml`):
```yaml
env:
  HUGO_PARAMS_STRIPE_PUBLISHABLEKEY: ${{ secrets.STRIPE_LIVE_PUBLISHABLE_KEY }}
  HUGO_PARAMS_STRIPE_PRICINGTABLEID: ${{ secrets.STRIPE_LIVE_PRICING_TABLE_ID }}
  HUGO_PARAMS_STRIPE_MODE: "live"
```

**Template Usage** (`hugo/layouts/join-cooperative/single.html`):
```html
{{ if .Site.Params.stripe.pricingtableid }}
  <script async src="https://js.stripe.com/v3/pricing-table.js"></script>
  <stripe-pricing-table
    pricing-table-id="{{ .Site.Params.stripe.pricingtableid }}"
    publishable-key="{{ .Site.Params.stripe.publishablekey }}">
  </stripe-pricing-table>
{{ end }}
```

**Result:**
- Same template code works for both test and production
- GitHub Actions injects appropriate keys based on context
- No manual key swapping needed

## Site Structure

### Content Organization

```
hugo/
├── content/           # Markdown content files
├── layouts/           # HTML templates
│   ├── _default/      # Default templates
│   ├── join-cooperative/  # Membership page templates
│   └── ...
├── static/            # Static assets
├── assets/            # Assets processed by Hugo Pipes (SCSS, etc.)
└── hugo.toml          # Site configuration
```

### Build Commands

```bash
# Development server (with drafts)
bun run hugo:dev        # localhost:1313

# Production build
bun run build           # Outputs to hugo/public/

# Build with search index
bun run build:search    # Includes Pagefind indexing
```

### Configuration File

**File:** `hugo/hugo.toml`

**Key Settings:**
- `baseURL`: Production URL
- `params.description`: Site meta description
- `params.recaptchaSiteKey`: reCAPTCHA public key
- `params.stripe.*`: Stripe configuration (overridden by env vars in CI)

## Common Tasks

### Add a New Page

```bash
# Create content file
hugo new content/your-page.md

# Edit the file
# Add frontmatter (title, date, etc.)
# Write content in Markdown

# View in dev server
bun run hugo:dev
```

### Modify Templates

Templates use Go templating language:
- `{{ .Title }}` - Access page variables
- `{{ .Content }}` - Render page content
- `{{ .Site.Params.* }}` - Access site parameters
- `{{ if condition }}...{{ end }}` - Conditionals

**Best Practice:** Test template changes locally with `bun run hugo:dev` before committing.

### Update Styles

SCSS files in `assets/scss/` are processed by Hugo Pipes:

```html
{{ define "head-styles" }}
  {{ $pageCSS := "scss/your-page.scss" }}
  {{ $options := (dict "transpiler" "dartsass" "outputStyle" "compressed") }}
  {{ $inlineCSS := resources.Get $pageCSS | css.Sass $options }}
  <style>{{ $inlineCSS.Content | safeCSS }}</style>
{{ end }}
```

## Deployment

### Preview Deployments (PRs)

- Automatic on PRs that modify `hugo/**`
- Deploys to Firebase Hosting preview channel
- Expires after 7 days
- Uses test Stripe keys

### Production Deployments (Trunk)

- Automatic on merge to `trunk`
- Deploys to `doulacooperative.com`
- Uses live Stripe keys (when configured)

## Troubleshooting

### Build Errors

```bash
# Check Hugo version (requires 0.129.0+ extended)
hugo version

# Build locally to see errors
cd hugo && hugo --minify

# Check for template syntax errors
hugo --logLevel debug
```

### Environment Variable Not Working

```bash
# Test locally
HUGO_PARAMS_YOUR_PARAM="value" hugo config | grep your

# Verify naming:
# - Use HUGO_PARAMS_ prefix
# - ONE underscore per nesting level
# - No CamelCase (converts to lowercase)
```

### Pricing Table Not Showing

**Check:**
1. Are GitHub Secrets set? (Settings → Secrets → Actions)
2. View page source - do attributes have values?
   ```html
   <stripe-pricing-table
     pricing-table-id=""  <!-- Empty? Secrets not set or wrong name -->
     publishable-key="">
   </stripe-pricing-table>
   ```
3. Check browser console for JavaScript errors
4. Verify template uses lowercase param names

## Resources

- [Hugo Documentation](https://gohugo.io/documentation/)
- [Hugo Environment Variables](https://gohugo.io/getting-started/configuration/#configure-with-environment-variables)
- [Hugo Templating](https://gohugo.io/templates/introduction/)
- [Stripe Pricing Tables](https://stripe.com/docs/payments/checkout/pricing-table)
- [Project Stripe Documentation](/docs/stripe/README.md)
