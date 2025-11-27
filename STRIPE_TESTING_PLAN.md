# Stripe Integration Testing Plan - Deployed Environment

## Understanding Stripe Sandboxes

Stripe uses **sandboxes** as completely isolated testing environments. Think of a sandbox as a separate Stripe account that:

- Has its own product catalog (products, prices, pricing tables)
- Has its own API keys (`pk_test_...` and `sk_test_...`)
- Has its own webhook endpoints and signing secrets
- Has its own customer and subscription data
- Uses test payment methods (like `4242 4242 4242 4242`) that don't charge real money
- Is completely separate from your production environment

**Key Point:** When testing, you'll configure your Hugo site and Firebase Functions to use your sandbox's keys, pricing table IDs, and webhook secrets. When going live, you'll switch to your production environment's configuration.

**Documentation:** [Stripe Sandboxes Guide](https://docs.stripe.com/sandboxes/dashboard/manage)

---

## Prerequisites

### Test Credit Cards (Stripe Sandbox)

Stripe provides test cards that won't charge real money. **IMPORTANT:** Ensure you're using your sandbox publishable key in the Hugo site.

**Primary Test Card:**

- Card number: `4242 4242 4242 4242`
- Expiry: Any future date (e.g., 12/26)
- CVC: Any 3 digits (e.g., 123)
- ZIP: Any valid ZIP code

**Other Test Cards:**

- Declined card: `4000 0000 0000 0002`
- Requires authentication: `4000 0027 6000 3184`

Full list: https://stripe.com/docs/testing#cards

**Important Security Note:** Test cards like `4242 4242 4242 4242` only work with sandbox API keys. When someone uses this card on your site:

- If your site uses sandbox keys → creates a test subscription (no real access to production services)
- If your site uses production keys → the test card is rejected

Real credit cards are rejected in sandboxes, and test cards are rejected in production. This prevents unauthorized access.

### Test Email Account

- **Primary test email:** webmaster@doulacooperative.com
- You'll need access to this inbox to verify welcome emails
- You may need to delete and recreate this user between scenarios

### Required Access

- Firebase Console (Auth, Firestore, Functions logs)
- Stripe Dashboard (Sandbox environment)
- Email inbox for webmaster@doulacooperative.com

### Environment Setup Checklist

**Stripe Sandbox Setup:**

- [ ] Created a dedicated Stripe sandbox for testing (Stripe Dashboard → Settings → Sandboxes)
- [ ] Sandbox has its own product catalog with membership pricing configured
- [ ] Sandbox has its own pricing table created
- [ ] Sandbox webhook endpoint is configured and listening to `checkout.session.completed` events

**Hugo Site Configuration:**

- [ ] Hugo site is using **sandbox** pricing table ID (from sandbox environment)
- [ ] Hugo site is using **sandbox** publishable key (`pk_test_...` from sandbox)
- [ ] Hugo site is deployed with sandbox configuration

**Firebase Configuration:**

- [ ] `STRIPE_API_KEY` Firebase secret is set to **sandbox** secret key (`sk_test_...` from sandbox)
- [ ] `STRIPE_WEBHOOK_SECRET` is set to sandbox webhook signing secret
- [ ] `MAILGUN_API_KEY` is configured
- [ ] `stripeWebhook` function is deployed

---

## Test Scenarios

### Scenario 1: New Member - Happy Path

**Goal:** Verify complete flow for a brand new member purchasing membership

**Pre-conditions:**

- webmaster@doulacooperative.com does NOT exist in Firebase Auth
- webmaster@doulacooperative.com does NOT exist in Firestore `members` collection

**Steps:**

1. Navigate to `https://doulacooperative.com/join-the-doula-cooperative`
2. Click on a pricing option in the Stripe Pricing Table
3. Fill out Stripe checkout form:
   - Email: `webmaster@doulacooperative.com`
   - Name: `Test Member`
   - Card: `4242 4242 4242 4242`
   - Expiry: `12/26`
   - CVC: `123`
   - ZIP: `14621`
4. Complete payment
5. Wait for redirect to success page

**Expected Results:**

- [ ] Redirected to `https://doulacooperative.com/join-success`
- [ ] Firebase Auth user created with email `webmaster@doulacooperative.com`
- [ ] Firebase Auth user has `emailVerified: false`
- [ ] Firestore `members` collection has document keyed by UID with:
  - `email: "webmaster@doulacooperative.com"`
  - `membershipActive: true`
  - `stripeCustomerId: "cus_..."`
  - `stripeSubscriptionId: "sub_..."`
  - `subscriptionStatus: "active"`
  - `subscriptionStart: <current timestamp>`
  - `membershipExpiresAt: <calculated expiration date>`
  - `welcomeEmailStatus: "sent"`
  - `welcomeEmailSentAt: <timestamp>`
  - `name: "Test Member"`
- [ ] Welcome email received at webmaster@doulacooperative.com
- [ ] Email contains password reset link
- [ ] Password reset link redirects to `https://members.doulacooperative.com/membership`
- [ ] Can set password via reset link
- [ ] Can sign in to members portal with new password
- [ ] Firestore `processedStripeEvents` collection has document for the event

**Verification Queries:**

```javascript
// Firebase Console → Firestore
// Query: members collection, filter by email
{
  email: "webmaster@doulacooperative.com",
  membershipActive: true,
  stripeCustomerId: "cus_...",
  subscriptionStatus: "active"
}

// Firebase Console → Auth
// Search for: webmaster@doulacooperative.com
// Verify user exists
```

**Function Logs to Check:**

```bash
firebase functions:log --only stripeWebhook
```

Look for:

- "Processing membership for: webmaster@doulacooperative.com"
- "Created user: <uid>"
- "Created member document for: webmaster@doulacooperative.com"
- "Welcome email sent successfully"

---

### Scenario 2: Existing User - Subscription Renewal

**Goal:** Verify behavior when user already exists but purchases again (e.g., lapsed member rejoining)

**Pre-conditions:**

- webmaster@doulacooperative.com EXISTS in Firebase Auth (from Scenario 1)
- webmaster@doulacooperative.com EXISTS in Firestore `members` collection
- May have `membershipActive: false` or expired membership

**Setup:**

1. In Firestore, update the member document to simulate lapsed membership:
   ```javascript
   {
     membershipActive: false,
     membershipExpiresAt: <past date>
     // Keep existing stripeCustomerId if present, or set to null
   }
   ```

**Steps:**

1. Navigate to `https://doulacooperative.com/join-the-doula-cooperative`
2. Complete payment with same email (use test card `4242 4242 4242 4242`)
3. Use **same email**: `webmaster@doulacooperative.com`

**Expected Results:**

- [ ] No error occurs (webhook handles existing user gracefully)
- [ ] Firebase Auth user is NOT duplicated (same UID)
- [ ] NO new welcome email sent (isNewUser = false)
- [ ] Firestore member document is UPDATED (not overwritten) with:
  - `membershipActive: true`
  - `stripeCustomerId: <new customer ID>`
  - `stripeSubscriptionId: <new subscription ID>`
  - `subscriptionStatus: "active"`
  - `subscriptionStart: <new timestamp>`
  - `membershipExpiresAt: <newly calculated date>`
- [ ] Existing fields in member document are preserved (e.g., slug, name, etc.)
- [ ] Can still sign in with existing password
- [ ] Member portal shows updated membership status

**Function Logs to Check:**

- "User already exists: webmaster@doulacooperative.com (<uid>)"
- "Updated existing member document for: webmaster@doulacooperative.com"
- Should NOT see "Created user" or "Welcome email sent"

---

### Scenario 3: Duplicate Webhook Event (Idempotency)

**Goal:** Verify system handles duplicate webhook deliveries gracefully

**Pre-conditions:**

- Complete Scenario 1 first so we have a processed event

**Steps:**

1. In Stripe Dashboard → Developers → Webhooks → Your endpoint
2. Find a recent `checkout.session.completed` event
3. Click "Resend" to send the same event again

**Expected Results:**

- [ ] Function returns `200` status
- [ ] Response body includes `"duplicate": true`
- [ ] NO duplicate user created
- [ ] NO duplicate member document created
- [ ] NO duplicate email sent
- [ ] Firestore `processedStripeEvents` collection still has only ONE document for this event ID

**Function Logs to Check:**

- "Event <event_id> already processed, skipping"
- Should see processedAt timestamp logged

---

### Scenario 4: Missing Customer Email

**Goal:** Verify error handling when email is not collected during checkout

**Pre-conditions:**

- Configure your sandbox's Pricing Table to NOT collect customer email (temporarily)
  - Switch to your sandbox in Stripe Dashboard
  - Navigate to Products → Pricing tables → Edit your sandbox pricing table
  - Disable "Collect customer email"
  - Save changes

**Steps:**

1. Complete a test purchase without providing email
2. Check webhook processing

**Expected Results:**

- [ ] Webhook returns `400` status
- [ ] Response body: "Missing customer email"
- [ ] NO user created
- [ ] NO member document created
- [ ] NO email sent

**Function Logs to Check:**

- Error logged with `ERROR_IDS.STRIPE_WEBHOOK_MISSING_EMAIL`
- "No customer email in checkout session"

**Cleanup:**

- Re-enable "Collect customer email" in your sandbox's Pricing Table

---

### Scenario 5: Webhook Signature Verification Failure

**Goal:** Verify security - reject webhooks with invalid signatures

**Pre-conditions:**

- Need to make a manual POST request or use Stripe CLI with wrong secret

**Steps:**

1. Use Stripe CLI to send event with mismatched webhook secret:
   ```bash
   # This will fail signature verification
   stripe trigger checkout.session.completed --override "stripe-signature=invalid"
   ```
   OR manually POST to webhook with invalid signature header

**Expected Results:**

- [ ] Webhook returns `400` status
- [ ] Response body: "Webhook signature verification failed"
- [ ] NO user created
- [ ] NO member document created

**Function Logs to Check:**

- Error logged with `ERROR_IDS.STRIPE_WEBHOOK_INVALID_SIGNATURE`
- "Webhook signature verification failed"

---

### Scenario 6: Email Delivery Failure

**Goal:** Verify system continues if email fails (non-critical failure)

**Pre-conditions:**

- Temporarily invalidate MAILGUN_API_KEY or use a bad key

**Setup:**

```bash
# Set invalid Mailgun key temporarily
firebase functions:secrets:set MAILGUN_API_KEY
# Enter: invalid-key-12345
# Redeploy function
firebase deploy --only functions:stripeWebhook
```

**Steps:**

1. Delete webmaster@doulacooperative.com from Firebase Auth
2. Complete purchase with test card

**Expected Results:**

- [ ] User IS created successfully
- [ ] Member document IS created successfully
- [ ] Webhook returns `200` status with `"emailSent": false`
- [ ] Member document has:
  - `welcomeEmailStatus: "failed"`
  - `welcomeEmailError: <error message>`
- [ ] User can still set password manually via "Forgot password" flow

**Function Logs to Check:**

- "Email failed but account is active"
- Error logged with `ERROR_IDS.STRIPE_WEBHOOK_EMAIL_FAILED`
- "actionRequired: Manually resend welcome email"

**Cleanup:**

```bash
# Restore valid Mailgun key
firebase functions:secrets:set MAILGUN_API_KEY
# Enter: <valid key>
firebase deploy --only functions:stripeWebhook
```

---

### Scenario 7: Auth User Creation Failure

**Goal:** Verify error handling when Firebase Auth fails

**Pre-conditions:**

- This is difficult to test without mocking, but you can simulate by:
  - Creating a user with invalid email format (if possible)
  - Or by checking logs from any real failures

**Steps:**

1. Attempt to trigger auth failure (may require code modification for testing)
2. Alternatively, review historical logs for any auth failures

**Expected Results:**

- [ ] Webhook returns `500` status
- [ ] Response body: "Unable to create account" or "Unable to verify account status"
- [ ] NO member document created (transaction rolled back)
- [ ] Stripe payment succeeded but account setup failed

**Function Logs to Check:**

- Error logged with `ERROR_IDS.STRIPE_WEBHOOK_USER_CREATE_FAILED` or `ERROR_IDS.STRIPE_WEBHOOK_AUTH_LOOKUP_FAILED`

**Note:** In production, you'd manually refund and contact customer

---

### Scenario 8: Member Document Creation Failure

**Goal:** Verify error handling when Firestore write fails

**Pre-conditions:**

- Could test by temporarily removing Firestore write permissions
- Or review historical logs

**Steps:**

1. If testing, temporarily modify Firestore rules to deny writes to `members` collection
2. Complete purchase

**Expected Results:**

- [ ] Webhook returns `500` status
- [ ] Response body: "Account created but setup incomplete - support will contact you"
- [ ] User IS created in Firebase Auth (orphaned)
- [ ] Member document is NOT created
- [ ] Error log includes `requiresManualIntervention: true`

**Function Logs to Check:**

- Error logged with `ERROR_IDS.STRIPE_WEBHOOK_MEMBER_DOC_CREATE_FAILED`
- "requiresManualIntervention: true"

**Cleanup:**

- Restore Firestore permissions
- Manually create member document for orphaned user

---

### Scenario 9: Membership Expiration Calculation

**Goal:** Verify expiration date is calculated correctly

**Pre-conditions:**

- Review the expiration logic in code:
  - `calculateExpirationDate()` in `functions/src/utils/membership-dates.ts`

**Steps:**

1. Complete purchase on various dates of the month
2. Check `membershipExpiresAt` field in Firestore

**Test Cases:**

| Purchase Date | Expected Expiration (if annual) |
| ------------- | ------------------------------- |
| 2025-01-15    | 2026-01-31                      |
| 2025-06-01    | 2026-06-30                      |
| 2025-12-25    | 2026-12-31                      |

**Expected Results:**

- [ ] Expiration date is last day of the subscription month
- [ ] Expiration date is in the next year (not current year)
- [ ] Date calculation handles leap years correctly

**Verification Query:**

```javascript
// In Firestore Console
// Check member document
{
  subscriptionStart: "2025-01-15T12:00:00Z",
  membershipExpiresAt: "2026-01-31T23:59:59Z"
}
```

---

### Scenario 10: Customer Name Handling

**Goal:** Verify name field is captured and stored

**Steps:**

1. Complete purchase with name provided in Stripe checkout
2. Complete purchase without name (if optional)

**Expected Results:**

**With Name:**

- [ ] Member document has `name: "Test Member"`
- [ ] Firebase Auth user has `displayName: "Test Member"`

**Without Name:**

- [ ] Member document has `name: undefined` or field omitted
- [ ] Firebase Auth user has no displayName

---

## Post-Testing Cleanup

After completing all scenarios:

1. **Delete test users:**

   ```bash
   # Firebase Console → Authentication
   # Find and delete webmaster@doulacooperative.com
   ```

2. **Delete member documents:**

   ```bash
   # Firestore Console → members collection
   # Delete test documents
   ```

3. **Delete processed events:**

   ```bash
   # Firestore Console → processedStripeEvents collection
   # Delete test event documents
   ```

4. **Cancel test subscriptions in your sandbox:**
   ```bash
   # Stripe Dashboard → Switch to your sandbox
   # Navigate to Customers
   # Find test customer, cancel subscription
   # Or simply delete the entire sandbox if you want a clean slate
   ```

---

## Monitoring and Logging

### Key Logs to Monitor

**During Testing:**

```bash
# Watch logs in real-time
firebase functions:log --only stripeWebhook --follow

# View recent logs
firebase functions:log --only stripeWebhook --limit 50
```

**Look for these log entries:**

- ✅ "Processing membership for: <email>"
- ✅ "User already exists: <email> (<uid>)"
- ✅ "User not found, will create new user for: <email>"
- ✅ "Created user: <uid>"
- ✅ "Created member document for: <email>"
- ✅ "Updated existing member document for: <email>"
- ✅ "Welcome email sent successfully"
- ❌ Any entries with `errorId:` field

### Stripe Dashboard Monitoring

**Webhook Delivery Status:**

1. Stripe Dashboard → Switch to your sandbox (top navigation)
2. Navigate to Developers → Webhooks → Your sandbox endpoint
3. Click on endpoint to see "Recent deliveries"
4. Check for:
   - ✅ Green checkmark (200 response)
   - ❌ Red X (400/500 response)
5. Click individual events to see:
   - Request body sent by Stripe
   - Response from your function
   - Response time

---

## Success Criteria

The integration is working correctly if:

- ✅ New members can complete purchase and receive welcome email
- ✅ Existing members can renew without creating duplicate accounts
- ✅ Duplicate webhooks are handled gracefully (idempotent)
- ✅ Invalid webhooks are rejected (signature verification)
- ✅ Email failures don't prevent account creation
- ✅ All member documents have correct Stripe IDs and expiration dates
- ✅ Function logs show no unexpected errors
- ✅ Stripe webhook dashboard shows 100% success rate for valid events

---

## Troubleshooting Guide

### Issue: Webhook not firing

**Check:**

- Ensure you're viewing the correct sandbox in Stripe Dashboard
- Stripe Dashboard → Developers → Webhooks → Recent deliveries
- Is webhook URL correct in the sandbox?
- Is webhook listening to `checkout.session.completed` event?
- Is function deployed?
- Check function logs for errors

### Issue: User not created

**Check:**

- Was customer email collected in checkout?
- Check function logs for auth errors
- Verify STRIPE_API_KEY is set correctly

### Issue: Member document not created

**Check:**

- Was user created in Auth?
- Check Firestore rules (do they allow writes?)
- Check function logs for Firestore errors

### Issue: Email not sent

**Check:**

- Is MAILGUN_API_KEY configured?
- Check function logs for Mailgun errors
- Verify email domain is configured in Mailgun
- Check spam folder

### Issue: Expiration date incorrect

**Check:**

- Review `calculateExpirationDate()` logic
- Check `subscriptionStart` timestamp
- Verify timezone handling

---

## Going Live Checklist

After successful testing in sandbox:

**Switch to Production Stripe Environment:**

- [ ] Navigate to your main Stripe account (not sandbox)
- [ ] Create production products and pricing in your main account's product catalog
- [ ] Create production pricing table
- [ ] Create production webhook endpoint listening to `checkout.session.completed`
- [ ] Note the production webhook signing secret

**Update Hugo Site:**

- [ ] Update Hugo site with **production** pricing table ID (from main account)
- [ ] Update Hugo site with **production** publishable key (`pk_live_...` from main account)
- [ ] Deploy Hugo site with production configuration

**Update Firebase:**

- [ ] Set `STRIPE_API_KEY` Firebase secret to **production** secret key (`sk_live_...` from main account)
- [ ] Set `STRIPE_WEBHOOK_SECRET` to production webhook signing secret
- [ ] Redeploy `stripeWebhook` function with production secrets

**Final Verification:**

- [ ] Verify webhook endpoint in Stripe Dashboard (main account) shows correct URL
- [ ] Complete one final test purchase with a real card (small amount, like $1 if you have a low-cost product)
- [ ] Verify webhook fired and user was created correctly
- [ ] Refund the test purchase
- [ ] Monitor function logs for first 24-48 hours

---

## Additional Notes

### Understanding Sandbox Isolation

Your sandbox is completely isolated from production:

- **Test cards only work in sandbox:** Someone using `4242 4242 4242 4242` on a site configured with sandbox keys creates test data that has no impact on production
- **Real cards only work in production:** Your production site (with live keys) will reject test cards
- **Separate data stores:** Customers, subscriptions, and webhooks in your sandbox don't affect production
- **Safe to experiment:** You can delete and recreate your entire sandbox without affecting your live business

This means you can safely deploy your Hugo site with sandbox configuration for testing without worrying about unauthorized real subscriptions.

### Test Data Management

Since you're using webmaster@doulacooperative.com for multiple scenarios, you'll need to delete and recreate this user frequently:

**Quick Delete Script:**

```bash
# Firebase Console → Authentication → Find user → Delete
# Firebase Console → Firestore → members → Find document by email → Delete
```

### Stripe Test Clock

Consider using Stripe's [Test Clocks](https://stripe.com/docs/billing/testing/test-clocks) feature to simulate subscription renewals and expirations without waiting a full year.

### Local Emulator Testing with Stripe CLI

While this plan focuses on deployed environments, you can also test locally with your sandbox:

```bash
# Terminal 1: Start Firebase emulators
cd functions
firebase emulators:start

# Terminal 2: Forward webhooks from your sandbox to local emulator
# Note: You'll need to authenticate with your sandbox
stripe listen --forward-to http://localhost:5001/YOUR-PROJECT/us-central1/stripeWebhook

# Terminal 3: Trigger test events (these will use your sandbox data)
stripe trigger checkout.session.completed
```

**Important:** When using Stripe CLI with a sandbox:

- The CLI will use your sandbox's configuration
- Events triggered will reference products/prices from your sandbox
- Make sure your local `STRIPE_WEBHOOK_SECRET` matches the CLI's signing secret (shown when you run `stripe listen`)

---

## Questions or Issues?

If you encounter unexpected behavior during testing:

1. Check function logs first
2. Check Stripe webhook delivery logs
3. Verify all secrets are configured correctly
4. Review the code in `functions/src/stripe-webhook/handler.ts` for logic errors
5. Check Firebase Auth and Firestore directly to see current state
