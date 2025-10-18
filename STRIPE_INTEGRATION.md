# Stripe Integration Setup Guide

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
- `hugo/content/join-the-doula-cooperative.md` - Added membership benefits and payment link placeholder
- `functions/package.json` - Added stripe dependency

## Setup Instructions

### 1. Install Stripe Dependency

The Stripe SDK has already been installed in the functions directory:

```bash
cd functions
npm install stripe  # Already completed
```

### 2. Create Stripe Product and Payment Link

1. Log in to your [Stripe Dashboard](https://dashboard.stripe.com/)
2. Go to **Products** → **Add Product**
3. Create a new product:
   - **Name:** Doula Membership
   - **Description:** Annual membership in the Rochester Doula Cooperative
   - **Price:** $100.00 USD
   - **Billing period:** Yearly (recurring)
4. After creating the product, click **Create payment link**
5. Configure the payment link:
   - Enable **Collect customer email** (required for account creation)
   - Optionally add customer name field
   - Set success URL: `https://doulacooperative.com/join-success` (or similar)
   - Set cancel URL: `https://doulacooperative.com/join-the-doula-cooperative`
6. Copy the payment link URL (format: `https://buy.stripe.com/xxxxx`)

### 3. Update Hugo Join Page

Replace the TODO placeholder in `hugo/content/join-the-doula-cooperative.md`:

```markdown
<!-- TODO: Replace with your actual Stripe Payment Link -->
[Join the Cooperative](https://buy.stripe.com/YOUR_PAYMENT_LINK_HERE)
```

With your actual Stripe payment link:

```markdown
[Join the Cooperative](https://buy.stripe.com/xxxxx)
```

### 4. Deploy Firebase Function

Deploy the new stripeWebhook function:

```bash
cd functions
npm run build
firebase deploy --only functions:stripeWebhook
```

After deployment, note the function URL from the output (e.g., `https://us-central1-your-project.cloudfunctions.net/stripeWebhook`)

### 5. Configure Stripe Secrets

Set the required secrets in Firebase:

```bash
# Stripe API Key (find in Stripe Dashboard → Developers → API Keys → Secret key)
firebase functions:secrets:set STRIPE_API_KEY

# You'll be prompted to enter the value - paste your sk_live_... or sk_test_... key
```

### 6. Configure Stripe Webhook

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

### 7. Test the Integration

#### Using Stripe Test Mode

1. Switch Stripe to **Test mode** (toggle in dashboard)
2. Use a test payment link (will start with `https://buy.stripe.com/test_...`)
3. Complete a test purchase using a [test card](https://stripe.com/docs/testing):
   - Card number: `4242 4242 4242 4242`
   - Expiry: Any future date
   - CVC: Any 3 digits
4. Check Firebase Functions logs for webhook processing:
   ```bash
   firebase functions:log --only stripeWebhook
   ```
5. Verify the user was created in Firebase Auth
6. Check that member document was created in Firestore `members` collection
7. Confirm welcome email was sent (check logs or your email)

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

### 8. Activate Legacy Members (One-time)

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

### 9. Go Live

Once testing is complete:

1. Switch Stripe to **Live mode**
2. Update Hugo join page with **live** payment link
3. Ensure `STRIPE_API_KEY` is set to your live key (`sk_live_...`)
4. Update webhook endpoint to use live mode
5. Deploy Hugo site with updated payment link:
   ```bash
   cd hugo
   hugo
   # Deploy public/ directory to Firebase Hosting
   ```

## How It Works

### User Flow

1. **Payment:** User visits `doulacooperative.com/join-the-doula-cooperative` and clicks "Join the Cooperative"
2. **Stripe Checkout:** Redirected to Stripe-hosted checkout page, completes payment
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
