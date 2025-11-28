# Stripe Integration Documentation

Complete documentation for the Rochester Doula Cooperative's Stripe-based membership subscription system.

## Quick Navigation

### Getting Started
- **[Local Development Guide](./LOCAL_DEVELOPMENT.md)** ⭐ Start here! Get testing in < 15 minutes
- **[Setup Guide](./SETUP.md)** - Initial Stripe integration setup and deployment
- **[Quick Reference](./QUICK_REFERENCE.md)** - One-page cheat sheet

### Testing
- **[Testing Guide](./TESTING_GUIDE.md)** - 10 comprehensive manual test scenarios
- **[PR Preview Testing](./PR_PREVIEW_TESTING.md)** - Test Hugo site changes privately in PR previews
- **[Troubleshooting Guide](./TROUBLESHOOTING.md)** - Debug common issues fast

### Production
- **[Production Monitoring](./PRODUCTION_MONITORING.md)** - Observability, alerts, and incident response

### Diagrams
- **[Webhook Flow Diagram](./diagrams/webhook-flow.mermaid)** - Visual flow of subscription process

## System Overview

The membership subscription system uses Stripe Pricing Tables for payment processing, with Firebase Functions handling webhook events to automatically create user accounts and manage subscriptions.

**Key Components:**
- **Stripe Pricing Table** - Embedded in Hugo static site
- **Firebase Function** (`stripeWebhook`) - Processes `checkout.session.completed` events
- **Firebase Auth** - User account management
- **Firestore** - Member document storage with subscription data
- **Mailgun** - Welcome email delivery

**User Flow:**
1. User completes payment via Stripe Pricing Table
2. Stripe sends webhook to Firebase Function
3. Function creates/updates Firebase Auth user
4. Function creates/updates Firestore member document
5. Function sends welcome email with password setup link
6. User sets password and accesses member portal

## Implementation Details

### Files and Locations

**Firebase Functions:**
- `/functions/src/stripe-webhook/handler.ts` - Main webhook handler logic
- `/functions/src/stripe-webhook/index.ts` - Function export
- `/functions/test/stripe-webhook.test.ts` - 53 unit tests

**Hugo Site:**
- `/hugo/layouts/join-cooperative/single.html` - Stripe Pricing Table integration

**Documentation:**
- `/docs/stripe/` - This directory (central location for all Stripe docs)

**Scripts:**
- `/functions/scripts/cleanup-test-data.ts` - Automated test cleanup
- `/functions/scripts/test-stripe-webhook.ts` - Manual webhook testing

### Test Coverage

**Automated Testing:**
- 53 unit tests covering all scenarios
- Run with: `cd functions && bun test stripe-webhook.test.ts`
- Integration tests (Stripe CLI) available but skipped in CI

**Manual Testing:**
- 10 comprehensive scenarios documented in [Testing Guide](./TESTING_GUIDE.md)
- Covers new users, existing users, edge cases, and error handling

## Common Tasks

### Local Development
```bash
# Start all services (emulators, Angular, Hugo)
bun start

# Run Stripe webhook tests
cd functions && bun test stripe-webhook.test.ts

# Forward webhooks to local function
stripe listen --forward-to http://localhost:5001/PROJECT/us-central1/stripeWebhook
```

### Test Data Cleanup
```bash
# Clean up test users and data
cd functions && bun run cleanup-test-data --email-pattern "@example.com"
```

### Manual Webhook Testing
```bash
# Trigger test webhook
cd functions && bun run test-webhook --email test@example.com
```

### Check Logs
```bash
# View recent webhook logs
firebase functions:log --only stripeWebhook --limit 50

# Watch logs in real-time
firebase functions:log --only stripeWebhook --follow
```

## Support and Resources

**Internal Documentation:**
- [CLAUDE.md](/CLAUDE.md) - Project development guidelines
- [functions/src/stripe-webhook/README.md](/functions/src/stripe-webhook/README.md) - Technical function docs

**External Resources:**
- [Stripe Documentation](https://stripe.com/docs)
- [Stripe Test Cards](https://stripe.com/docs/testing#cards)
- [Firebase Functions Docs](https://firebase.google.com/docs/functions)
- [Stripe CLI Docs](https://stripe.com/docs/stripe-cli)

## Recent Updates

See individual documentation files for changelogs and update history.

---

**Questions or issues?** Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) first, then review function logs for error IDs.
