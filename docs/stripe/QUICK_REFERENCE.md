# Stripe Integration Quick Reference

One-page cheat sheet for daily development.

## Essential Commands

### Start Development
```bash
bun start                    # Start all services (emulators, Angular, Hugo)
```

### Run Tests
```bash
cd functions && bun test stripe-webhook.test.ts   # Run Stripe tests (53 tests)
cd functions && bun test --watch                   # Watch mode
```

### Stripe CLI
```bash
stripe login                                        # Authenticate
stripe trigger checkout.session.completed          # Test event (uses jenny.rosen@example.com)
stripe listen --forward-to http://localhost:5001/PROJECT/us-central1/stripeWebhook --skip-verify
```

### View Logs
```bash
firebase functions:log --only stripeWebhook --follow   # Watch logs real-time
firebase functions:log --only stripeWebhook --limit 50 # Recent 50 entries
```

### Deploy
```bash
cd functions && bun run build                        # Build functions
firebase deploy --only functions:stripeWebhook      # Deploy webhook function
```

## Test Credit Cards

| Purpose | Card Number | Expiry | CVC | ZIP |
|---------|-------------|--------|-----|-----|
| **Success** | `4242 4242 4242 4242` | Any future | Any 3 digits | Any |
| **Declined** | `4000 0000 0000 0002` | Any future | Any 3 digits | Any |
| **Requires Auth** | `4000 0027 6000 3184` | Any future | Any 3 digits | Any |

**Test Mode Only!** These cards only work with `pk_test_...` / `sk_test_...` keys.

## Firebase Secrets

### Required Environment Variables

| Secret | Location | Purpose |
|--------|----------|---------|
| `STRIPE_API_KEY` | Firebase Functions | Stripe API access (`sk_test_...` or `sk_live_...`) |
| `STRIPE_WEBHOOK_SECRET` | Firebase Functions | Verify webhook signatures (`whsec_...`) |
| `MAILGUN_API_KEY` | Firebase Functions | Send welcome emails |

### Managing Secrets

```bash
# View secret
firebase functions:secrets:access STRIPE_API_KEY

# Set new secret
firebase functions:secrets:set STRIPE_API_KEY
# Paste value when prompted, then redeploy function

# For local development, use functions/.env.local
```

## Webhook Event Types

| Event | Status | Description |
|-------|--------|-------------|
| `checkout.session.completed` | ✅ Implemented | New subscription created |
| `customer.subscription.updated` | ⏳ Future | Subscription changed/renewed |
| `customer.subscription.deleted` | ⏳ Future | Subscription canceled |

## Common Queries

### Firestore Queries (Emulator UI or Console)

**Find member by email:**
```javascript
collection: members
where: email == "test@example.com"
```

**Find active memberships:**
```javascript
collection: members
where: membershipActive == true
where: membershipExpiresAt > now
```

**Find failed email deliveries:**
```javascript
collection: members
where: welcomeEmailStatus == "failed"
order by: createdAt desc
```

**Check processed events:**
```javascript
collection: processedStripeEvents
where: eventId == "evt_xxxxx"
```

## Error IDs

When debugging, look for these ERROR_IDs in logs:

| Error ID | Issue |
|----------|-------|
| `STRIPE_WEBHOOK_MISSING_SECRETS` | API key or webhook secret not configured |
| `STRIPE_WEBHOOK_MISSING_SIGNATURE` | No stripe-signature header |
| `STRIPE_WEBHOOK_INVALID_SIGNATURE` | Signature verification failed (security) |
| `STRIPE_WEBHOOK_MISSING_EMAIL` | No email in checkout session |
| `STRIPE_WEBHOOK_USER_CREATE_FAILED` | Firebase Auth failed to create user |
| `STRIPE_WEBHOOK_MEMBER_DOC_CREATE_FAILED` | Firestore write failed |
| `STRIPE_WEBHOOK_EMAIL_FAILED` | Mailgun failed to send email (non-critical) |
| `STRIPE_WEBHOOK_MAILGUN_NOT_CONFIGURED` | MAILGUN_API_KEY not set |

## URLs & Access Points

### Local Development
- **Emulator UI**: http://localhost:4000
- **Hugo Site**: http://localhost:1313
- **Angular Portal**: http://localhost:4200
- **Firestore**: http://localhost:8080
- **Auth**: http://localhost:9099
- **Functions**: http://localhost:5001

### Production
- **Main Site**: https://doulacooperative.com
- **Members Portal**: https://members.doulacooperative.com
- **Webhook**: https://us-central1-PROJECT.cloudfunctions.net/stripeWebhook

### Dashboards
- **Stripe Dashboard**: https://dashboard.stripe.com
- **Firebase Console**: https://console.firebase.google.com
- **Mailgun Dashboard**: https://app.mailgun.com

## File Locations

### Key Implementation Files
```
/functions/src/stripe-webhook/
├── handler.ts          # Main webhook logic
├── index.ts            # Function export
└── types.ts            # TypeScript types

/functions/test/
└── stripe-webhook.test.ts    # 53 unit tests

/functions/src/constants/
└── stripe.ts                 # Secret names

/hugo/layouts/join-cooperative/
└── single.html              # Pricing table integration
```

### Documentation
```
/docs/stripe/
├── README.md                 # This directory
├── LOCAL_DEVELOPMENT.md      # Quick start guide
├── SETUP.md                  # Initial setup
├── TESTING_GUIDE.md          # 10 test scenarios
├── TROUBLESHOOTING.md        # Debug guide
├── PRODUCTION_MONITORING.md  # Observability
└── QUICK_REFERENCE.md        # This file
```

## Typical Member Document Structure

```javascript
{
  uid: "firebase-auth-uid",
  email: "member@example.com",
  name: "Member Name",
  membershipActive: true,
  stripeCustomerId: "cus_xxxxx",
  stripeSubscriptionId: "sub_xxxxx",
  subscriptionStatus: "active",
  subscriptionStart: Timestamp,
  membershipExpiresAt: Timestamp,
  createdAt: Timestamp,
  welcomeEmailStatus: "sent" | "failed" | "pending",
  welcomeEmailSentAt: Timestamp,
  welcomeEmailError: "error message if failed"
}
```

## Emergency Procedures

### Webhook Completely Down

```bash
# 1. Check function health
firebase functions:list | grep stripeWebhook

# 2. Check recent logs
firebase functions:log --only stripeWebhook --limit 50 | grep ERROR

# 3. Verify secrets
firebase functions:secrets:access STRIPE_API_KEY
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET

# 4. Redeploy if needed
firebase deploy --only functions:stripeWebhook
```

### Failed Webhook - Manual Recovery

```bash
# 1. Get event details from Stripe Dashboard → Webhooks → Event
# 2. Note: customer_email, customer_id, subscription_id

# 3. Manually create user in Firebase Auth Console
# 4. Manually create member document in Firestore Console
# 5. Send password reset email manually
```

### Cancel Test Subscription

```bash
# Stripe Dashboard (Test Mode) → Customers → Find customer → Cancel subscription
# Or delete customer entirely for cleanup
```

## Testing Accounts

### Local Development (Emulators)
- **Email**: webmaster@doulacooperative.com
- **Password**: test1234
- Use for testing both Auth and Stripe flows

### Default Stripe CLI Test User
- **Email**: jenny.rosen@example.com
- Used by `stripe trigger checkout.session.completed`

## Quick Troubleshooting

| Symptom | Quick Fix |
|---------|-----------|
| Webhook not firing | Check `stripe listen` is running; verify URL |
| Signature error | Update `STRIPE_WEBHOOK_SECRET`; restart emulators |
| User not created | Check customer email was collected in checkout |
| Member doc not created | Check function logs for ERROR_IDs; verify Firestore rules |
| Email not sent | Expected in emulator mode; check logs for "Would have sent" |
| Emulator won't start | Run `firebase emulators:kill` then restart |
| Stripe CLI errors | Run `stripe login` again |

## Documentation Links

- **[Local Development](./LOCAL_DEVELOPMENT.md)** - Detailed setup guide
- **[Testing Guide](./TESTING_GUIDE.md)** - 10 test scenarios
- **[Troubleshooting](./TROUBLESHOOTING.md)** - Comprehensive debugging
- **[Setup Guide](./SETUP.md)** - Initial configuration
- **[Production Monitoring](./PRODUCTION_MONITORING.md)** - Observability

## External Resources

- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Stripe CLI Docs](https://stripe.com/docs/stripe-cli)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Stripe Webhooks Guide](https://stripe.com/docs/webhooks)

---

**Pro Tip:** Bookmark this page for daily reference!
