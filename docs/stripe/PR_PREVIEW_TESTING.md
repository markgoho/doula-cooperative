# PR Preview Testing with Stripe

How to test Stripe Pricing Table changes privately using Firebase Hosting preview channels.

## Navigation

- [← Back to Stripe Docs](./README.md)
- [Local Development Guide](./LOCAL_DEVELOPMENT.md)
- [Setup Guide](./SETUP.md)
- [Testing Guide](./TESTING_GUIDE.md)

---

## Overview

When you open a PR that modifies the Hugo site, a GitHub Actions workflow automatically:
1. Builds the Hugo site with **test mode Stripe configuration**
2. Deploys to a temporary preview URL (e.g., `doula-cooperative--pr-123-abc.web.app`)
3. Posts the preview URL as a PR comment
4. Auto-deletes the preview when PR is closed

**This lets you test the full Stripe checkout flow privately before merging to production.**

## How It Works

### The Workflow

**File:** `.github/workflows/hugo-hosting-pull-request.yml`

**Triggers on:**
- PRs that modify `hugo/**`
- PRs that modify `firebase.json`
- PRs that modify the workflow file itself

**What it does:**
```yaml
1. Checkout code
2. Build Hugo with environment variables:
   - HUGO_PARAMS_STRIPE_PUBLISHABLE_KEY (test key)
   - HUGO_PARAMS_STRIPE_PRICING_TABLE_ID (test pricing table)
   - HUGO_PARAMS_STRIPE_MODE=test
3. Deploy to Firebase preview channel (expires in 7 days)
4. Comment on PR with preview URL and testing instructions
```

### Environment Variables Strategy

**Preview Deployments (PRs):**
- Use `STRIPE_TEST_PUBLISHABLE_KEY` from GitHub Secrets
- Use `STRIPE_TEST_PRICING_TABLE_ID` from GitHub Secrets
- Sets `HUGO_PARAMS_STRIPE_MODE=test`

**Production Deployments (trunk):**
- Use live Stripe keys (configured in Hugo config or separate workflow)
- Sets `HUGO_PARAMS_STRIPE_MODE=live`

## Setup Instructions

### 1. Configure GitHub Secrets

Add these secrets to your GitHub repository:

**Settings → Secrets and variables → Actions → New repository secret**

| Secret Name | Value | Where to Find |
|-------------|-------|---------------|
| `STRIPE_TEST_PUBLISHABLE_KEY` | `pk_test_...` | Stripe Dashboard (test mode) → Developers → API Keys |
| `STRIPE_TEST_PRICING_TABLE_ID` | `prctbl_test_...` | Stripe Dashboard (test mode) → Products → Pricing tables |
| `STRIPE_LIVE_PUBLISHABLE_KEY` | `pk_live_...` | Stripe Dashboard (live mode) → Developers → API Keys |
| `STRIPE_LIVE_PRICING_TABLE_ID` | `prctbl_live_...` | Stripe Dashboard (live mode) → Products → Pricing tables |

**Note:** These are publishable keys (safe to expose in HTML), not secret keys.

### 2. Update Hugo Template

**File:** `hugo/layouts/join-cooperative/single.html`

Update the Stripe Pricing Table section to use Hugo params:

```html
{{ if .Site.Params.stripe.enabled }}
<section class="membership-join text-content">
  <h2>Cooperative Membership, 1 Year</h2>

  <script async src="https://js.stripe.com/v3/pricing-table.js"></script>
  <stripe-pricing-table
    pricing-table-id="{{ .Site.Params.stripe.pricingTableId }}"
    publishable-key="{{ .Site.Params.stripe.publishableKey }}"
  ></stripe-pricing-table>

  {{ if eq .Site.Params.stripe.mode "test" }}
  <div class="callout callout--warning">
    <p><strong>⚠️ Test Mode:</strong> This is a preview deployment using Stripe test mode. Use test card <code>4242 4242 4242 4242</code> to complete checkout.</p>
  </div>
  {{ end }}
</section>
{{ else }}
<section class="membership-join text-content">
  <h2>Cooperative Membership, 1 Year</h2>
  <p class="price">
    <span class="currency-symbol">$</span>
    <span class="amount">50</span>
  </p>
  <button class="membership-cta button" disabled>Join the Cooperative</button>
  <div class="callout">
    <p><strong>Note:</strong> New memberships have been paused temporarily.</p>
  </div>
</section>
{{ end }}
```

### 3. Update Hugo Config

**File:** `hugo/config.toml` (or `hugo/config.yaml`)

Add Stripe parameters:

```toml
[params.stripe]
  enabled = false  # Set to true when ready to enable Stripe
  mode = "live"    # Override with env var in CI
  publishableKey = "pk_live_..."  # Override with env var in CI
  pricingTableId = "prctbl_..."   # Override with env var in CI
```

Or if using YAML:
```yaml
params:
  stripe:
    enabled: false
    mode: live
    publishableKey: pk_live_...
    pricingTableId: prctbl_...
```

### 4. Update Production Workflow

**File:** `.github/workflows/hugo-hosting-merge.yml`

Add environment variables for production:

```yaml
- name: Build Hugo site
  run: bun run build
  env:
    HUGO_PARAMS_STRIPE_PUBLISHABLE_KEY: ${{ secrets.STRIPE_LIVE_PUBLISHABLE_KEY }}
    HUGO_PARAMS_STRIPE_PRICING_TABLE_ID: ${{ secrets.STRIPE_LIVE_PRICING_TABLE_ID }}
    HUGO_PARAMS_STRIPE_MODE: "live"
    HUGO_PARAMS_STRIPE_ENABLED: "true"
```

## Testing Workflow

### Step 1: Create PR with Stripe Changes

```bash
# Create feature branch
git checkout -b add-stripe-pricing-table

# Update Hugo template (as shown above)
# Commit changes
git add hugo/layouts/join-cooperative/single.html
git commit -m "Add Stripe Pricing Table with test mode support"
git push origin add-stripe-pricing-table
```

### Step 2: Open PR on GitHub

The workflow automatically:
1. Builds Hugo site with test Stripe keys
2. Deploys to preview channel
3. Comments on PR with preview URL

**Example PR comment:**
```
🔍 Hugo Preview Deployment

Preview URL: https://doula-cooperative--pr-123-abc.web.app

⚠️ Testing Stripe: This preview uses test mode Stripe keys.
- Use test card: 4242 4242 4242 4242
- Test data won't affect production
- Webhooks will fire to configured test endpoint
```

### Step 3: Test on Preview URL

1. Visit the preview URL
2. Navigate to `/join-the-doula-cooperative`
3. See the Stripe Pricing Table (in test mode)
4. Complete checkout with test card `4242 4242 4242 4242`
5. Verify webhook processes correctly:
   ```bash
   firebase functions:log --only stripeWebhook --follow
   ```
6. Check Firebase Auth and Firestore for new user

### Step 4: Merge When Ready

Once testing looks good:
1. Get PR approved
2. Merge to trunk
3. Production workflow deploys with live Stripe keys
4. Preview URL automatically cleaned up

## Important Considerations

### Webhook Endpoints

**Issue:** Preview deployments and production need different webhook endpoints

**Solution 1: Single Webhook (Recommended for now)**
- Keep one webhook endpoint that handles both test and live events
- Stripe automatically sends test events to test webhooks, live events to live webhooks
- Your Firebase Function works with both

**Solution 2: Separate Webhooks (Advanced)**
- Configure separate webhook endpoints for test and live
- Update Firebase Function URL in Stripe Dashboard based on environment
- More isolation but more complex

### Firebase Functions on Preview

**Note:** Firebase Hosting preview channels only deploy hosting, not Functions.

This means:
- ✅ Hugo site deploys to preview URL
- ❌ Firebase Functions stay on the deployed version
- ✅ Webhooks still work (they call the deployed function)

**Implication:**
- Stripe webhooks from preview will call your existing deployed `stripeWebhook` function
- Make sure your function handles test mode events appropriately
- Function already handles both test and live events correctly

### Test Data Management

When testing on preview:
- Use test cards (`4242 4242 4242 4242`)
- Creates real Firebase Auth users and Firestore documents
- Clean up test data after testing:
  ```bash
  cd functions && bun run cleanup-test-data --email-pattern "@example.com"
  ```

## Security

**Publishable Keys Are Safe in HTML**
- `pk_test_...` and `pk_live_...` are designed to be public
- They only allow creating checkout sessions, not accessing customer data
- Secret keys (`sk_test_...`, `sk_live_...`) must NEVER be in HTML or Git

**Test Mode Isolation**
- Test keys can't charge real cards
- Test cards can't work with live keys
- Completely isolated environments in Stripe

## Troubleshooting

### Preview deployment succeeds but Pricing Table doesn't appear

**Check:**
1. View page source of preview URL
2. Look for `<stripe-pricing-table>` element
3. Verify `pricing-table-id` and `publishable-key` attributes have values
4. Check browser console for JavaScript errors

### Pricing Table appears but checkout fails

**Check:**
1. Verify you're using a test card (`4242 4242 4242 4242`)
2. Check Stripe Dashboard (test mode) for checkout session
3. Verify webhook endpoint is configured in Stripe Dashboard
4. Check Firebase Functions logs for webhook errors

### Webhook not firing on preview

**Expected!** Webhooks fire to the endpoint configured in Stripe Dashboard, which points to your deployed Function (not the preview).

**Testing strategy:**
- Preview shows the UI/UX
- Webhook testing happens against deployed function
- Full integration tests in staging or production

## Future Enhancements

### Option 1: Preview-Specific Webhook Endpoint

Create a separate test webhook endpoint:
```bash
# Deploy test-specific function
firebase deploy --only functions:stripeWebhookTest

# Configure in Stripe Dashboard (test mode)
# Point webhook to: https://...cloudfunctions.net/stripeWebhookTest
```

### Option 2: Deploy Functions in Preview

Modify workflow to also deploy functions:
```yaml
- name: Deploy functions to preview
  run: |
    cd functions
    npm run build
    firebase deploy --only functions:stripeWebhook --project doula-cooperative
```

**Caution:** This deploys functions to your default project, not an isolated preview.

## Summary

**What you get:**
- ✅ Private preview URL for each PR
- ✅ Automatic test mode Stripe configuration
- ✅ Safe testing environment
- ✅ Auto-cleanup after 7 days

**Limitations:**
- Functions don't deploy to preview (use shared deployed function)
- Test data is created in real Firebase (requires cleanup)
- Preview URLs expire after 7 days

**Next Steps:**
1. Add GitHub Secrets for test Stripe keys
2. Update Hugo template to use params
3. Test on your next PR!

---

**Questions?** See [Local Development Guide](./LOCAL_DEVELOPMENT.md) or [Troubleshooting](./TROUBLESHOOTING.md).
