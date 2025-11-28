# Stripe Integration Setup Guide

Complete setup and deployment guide for the Stripe-based membership subscription system.

## Navigation

- [← Back to Stripe Docs](./README.md)
- [Local Development Guide](./LOCAL_DEVELOPMENT.md) - Quick start for developers ⭐
- [Testing Guide](./TESTING_GUIDE.md) - Manual testing scenarios
- [Troubleshooting](./TROUBLESHOOTING.md) - Debug issues
- [Production Monitoring](./PRODUCTION_MONITORING.md) - Observability
- [Quick Reference](./QUICK_REFERENCE.md) - Cheat sheet

---

This guide explains how to complete the Stripe-based membership sign-up flow that was implemented.

## Overview

The system now supports a payment-first membership flow where users pay via Stripe on the Hugo static site, then Firebase automatically creates their account and sends a welcome email with password setup instructions.

## Implementation Summary

### Files Created/Modified

**New Files:**

- `functions/src/stripe-webhook/index.ts` - Webhook function export
- `functions/src/stripe-webhook/handler.ts` - Webhook business logic
- `functions/src/stripe-webhook/types.ts` - TypeScript types for Stripe events
- `functions/src/constants/stripe.ts` - Stripe secret constants
- `functions/src/scripts/activate-legacy-members.ts` - One-time script to grandfather existing members

**Modified Files:**

- `functions/src/index.ts` - Added stripeWebhook export
- `functions/src/types/member-document.ts` - Added Stripe fields (stripeCustomerId, stripeSubscriptionId, subscriptionStatus)
- `members/src/app/services/membership.service.ts` - Updated Member interface with Stripe fields
- `hugo/layouts/join-cooperative/single.html` - Integrated Stripe Pricing Table widget
- `functions/package.json` - Added stripe dependency

## Setup Instructions

### 1. Install Stripe Dependency

The Stripe SDK has already been installed in the functions directory:

```bash
cd functions
npm install stripe  # Already completed
```

### 2. Stripe Pricing Table Configuration

The Hugo site uses a **Stripe Pricing Table** widget (not a payment link) that is already integrated in `hugo/layouts/join-cooperative/single.html`.

**Current Implementation:**

```html
<stripe-pricing-table
  pricing-table-id="prctbl_1SJdC0JnElCHrlM6MYmo3xVd"
  publishable-key="pk_live_51SJca8JnElCHrlM6AUzlWNeJHh05jb3j0YqdeNR73AHgFruGmeA3BALuAnRAO1ccbo7DYqH474X4wGjnp6HsGUf600VWHGFDjS"
>
</stripe-pricing-table>
```

**To Update Pricing Table (if needed):**

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to **Products** → Select your product → **Pricing tables**
3. Create or edit a pricing table with your membership product
4. Configure settings:
   - Enable **Collect customer email** (required for account creation)
   - Enable **Collect customer name** (optional but recommended)
   - Set success URL: `https://doulacooperative.com/join-success`
   - Set cancel URL: `https://doulacooperative.com/join-the-doula-cooperative`
5. Copy the `pricing-table-id` and `publishable-key`
6. Update the widget in `hugo/layouts/join-cooperative/single.html`

**Note:** Stripe Pricing Tables provide a better UX than payment links, allowing customers to see pricing details inline without leaving your site.

### 3. Deploy Firebase Function

Deploy the new stripeWebhook function:

```bash
cd functions
npm run build
firebase deploy --only functions:stripeWebhook
```

After deployment, note the function URL from the output (e.g., `https://us-central1-your-project.cloudfunctions.net/stripeWebhook`)

### 4. Configure Stripe Secrets

Set the required secrets in Firebase:

```bash
# Stripe API Key (find in Stripe Dashboard → Developers → API Keys → Secret key)
firebase functions:secrets:set STRIPE_API_KEY

# You'll be prompted to enter the value - paste your sk_live_... or sk_test_... key
```

### 5. Configure Stripe Webhook

1. In Stripe Dashboard, go to **Developers** → **Webhooks**
2. Click **Add endpoint**
3. Set **Endpoint URL** to your deployed function URL:
   ```
   https://us-central1-your-project.cloudfunctions.net/stripeWebhook
   ```
4. Select **Events to send:**
   - Check `checkout.session.completed`
5. Click **Add endpoint**
6. Copy the **Signing secret** (starts with `whsec_...`)
7. Set the webhook secret in Firebase:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Paste the whsec_... value when prompted
   ```

### 6. Test the Integration

#### Using Stripe Test Mode

1. Switch Stripe to **Test mode** (toggle in dashboard)
2. Create a test pricing table in Stripe Dashboard
3. Update the Hugo template with test pricing table ID and test publishable key
4. Complete a test purchase using a [test card](https://stripe.com/docs/testing):
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
5. Check Firebase Functions logs for webhook processing:
   ```bash
   firebase functions:log --only stripeWebhook
   ```
6. Verify the user was created in Firebase Auth
7. Check that member document was created in Firestore `members` collection
8. Confirm welcome email was sent (check logs or your email)

#### Using Stripe CLI for Local Testing

For local development with emulators:

```bash
# Install Stripe CLI: https://stripe.com/docs/stripe-cli
stripe login

# Forward webhooks to local emulator
stripe listen --forward-to http://localhost:5001/your-project/us-central1/stripeWebhook

# In another terminal, trigger a test event
stripe trigger checkout.session.completed
```

### 7. Activate Legacy Members (One-time)

If you have existing members in the `migrated_users_import` collection who should be grandfathered in:

```bash
cd functions

# Option 1: Run as a script (requires ts-node)
npx ts-node src/scripts/activate-legacy-members.ts

# Option 2: Deploy as a callable function and invoke once
# (Add export to src/index.ts and deploy, then call via Firebase Console)
```

This script will:

- Query all documents in `migrated_users_import`
- Set `membershipActive: true` for each
- Calculate and set `membershipExpiresAt` based on their `subscriptionStart` date

### 8. Go Live

Once testing is complete:

1. Switch Stripe to **Live mode**
2. Update Hugo template with **live** pricing table ID and live publishable key
3. Ensure `STRIPE_API_KEY` is set to your live key (`sk_live_...`)
4. Update webhook endpoint to use live mode
5. Deploy Hugo site:
   ```bash
   cd hugo
   hugo
   firebase deploy --only hosting:main-site
   ```

## How It Works

### User Flow

1. **Payment:** User visits `doulacooperative.com/join-the-doula-cooperative` and views the Stripe Pricing Table
2. **Stripe Checkout:** Clicks a pricing option, redirected to Stripe-hosted checkout page, completes payment
3. **Webhook:** Stripe sends `checkout.session.completed` event to Firebase Function
4. **Account Creation:** Firebase Function:
   - Verifies webhook signature
   - Creates Firebase Auth user with temporary password
   - Creates member document in Firestore with Stripe IDs
   - Sends welcome email via Mailgun with password reset link
5. **Email:** User receives welcome email with link to set password
6. **Password Setup:** User clicks link, sets password via Firebase Auth
7. **Access:** User signs in to members portal with their email and new password

### Technical Details

- **Webhook Security:** Signatures verified using `stripe.webhooks.constructEvent()`
- **Idempotency:** If user already exists (by email), updates their member document instead of creating new user
- **Temporary Password:** Generated securely using crypto, never sent to user (only password reset link)
- **Membership Expiration:** Calculated based on subscription start date, renews annually
- **Email Integration:** Uses existing Mailgun setup with `sendEmail()` utility
- **Stripe Metadata:** Stores `stripeCustomerId` and `stripeSubscriptionId` in member document for future subscription management

## Subscription Management (Future Enhancements)

The current implementation handles initial purchase. Future enhancements could include:

- Listen for `customer.subscription.updated` webhook to handle subscription renewals
- Listen for `customer.subscription.deleted` webhook to deactivate expired memberships
- Add admin dashboard to view subscription status
- Implement self-service billing portal via Stripe Customer Portal
- Handle failed payment retries and grace periods

## Troubleshooting

### Webhook Not Firing

- Check Stripe Dashboard → Developers → Webhooks → [Your Endpoint] → Recent deliveries
- Verify endpoint URL matches deployed function
- Check Firebase Functions logs: `firebase functions:log --only stripeWebhook`

### User Not Created

- Check function logs for error messages
- Verify `STRIPE_API_KEY` and `STRIPE_WEBHOOK_SECRET` are set correctly
- Ensure customer email was collected during checkout

### Email Not Sent

- Verify `MAILGUN_API_KEY` is set in Firebase secrets
- Check function logs for Mailgun errors
- In emulator mode, emails are logged but not sent (check console output)

### Testing Locally

Use Stripe CLI to forward webhooks:

```bash
stripe listen --forward-to http://localhost:5001/your-project/us-central1/stripeWebhook
```

## Security Considerations

- ✅ Webhook signatures verified on every request
- ✅ Temporary passwords never exposed to user
- ✅ Secrets stored in Firebase Functions secrets (not committed to git)
- ✅ Payment processing handled entirely by Stripe (PCI compliant)
- ✅ Firebase Auth handles password reset flow securely
- ✅ HTTPS enforced for all Firebase Functions endpoints

## Support

For issues or questions:

- Stripe Documentation: https://stripe.com/docs
- Firebase Functions: https://firebase.google.com/docs/functions
- Firebase Auth: https://firebase.google.com/docs/auth
