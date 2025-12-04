# Stripe Local Development Guide

Get up and running with Stripe webhook testing in < 15 minutes.

## Prerequisites

### Required Software

- ✅ **Bun** - Package manager (already installed per CLAUDE.md)
- ✅ **Firebase CLI** - `firebase --version` to verify
- ✅ **Stripe CLI** - Download from [stripe.com/docs/stripe-cli](https://stripe.com/docs/stripe-cli)
- ✅ **Git** - For repository management

### Required Access

- Stripe Dashboard access (test mode)
- Firebase project access
- Access to `.env.local` secrets (ask team lead)

### Verify Installation

```bash
# Check all required tools
bun --version      # Should show 1.x.x
firebase --version # Should show 12.x.x or higher
stripe --version   # Should show 1.x.x

# Authenticate with Stripe
stripe login

# Authenticate with Firebase
firebase login
```

## Quick Start (5 Minutes)

### 1. Clone and Install

```bash
# Navigate to project
cd /path/to/doula-cooperative

# Install all dependencies
bun install
cd functions && bun install && cd ..
cd members && bun install && cd ..
```

### 2. Setup Environment Secrets

For local testing, you need test mode secrets in `functions/.env.local`:

```bash
# Create the file if it doesn't exist
touch functions/.env.local
```

Edit `functions/.env.local` and add:

```env
# Stripe Test Mode Keys (from Stripe Dashboard → Developers → API Keys)
STRIPE_API_KEY=sk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# Mailgun API Key (for welcome emails)
MAILGUN_API_KEY=...

# Note: When using `stripe listen`, it generates its own webhook secret
# The secret above is for deployed endpoints only
```

**Where to find these values:**

- `STRIPE_API_KEY`: Stripe Dashboard → Developers → API Keys → Secret key (test mode)
- `STRIPE_WEBHOOK_SECRET`: For local dev, this comes from `stripe listen` command output
- `MAILGUN_API_KEY`: Mailgun dashboard → API Keys

### 3. Start Development Environment

```bash
# Start all services (Terminal 1)
bun start
```

This single command starts:

- **Firebase Emulators** (Auth: 9099, Firestore: 8080, Functions: 5001)
- **Hugo Dev Server** (localhost:1313)
- **Angular Dev Server** (localhost:4200)
- **Functions TypeScript Watcher**

**Verify everything started:**

- Open http://localhost:4000 (Emulator UI)
- Open http://localhost:1313 (Hugo site)
- Open http://localhost:4200 (Angular members portal)

### 4. Forward Stripe Webhooks (Optional - for manual testing)

```bash
# Terminal 2: Forward webhooks to local function
cd functions
stripe listen --forward-to http://localhost:5001/doula-cooperative-test/us-central1/stripeWebhook --skip-verify
```

**Important:** Copy the signing secret from the output:

```
> Ready! Your webhook signing secret is whsec_xxxxxxxxxxxxx
```

If you want to test real webhook delivery, update `functions/.env.local` with this secret.

### 5. Run Tests

```bash
# Terminal 3: Run unit tests
cd functions
bun test stripe-webhook.test.ts

# Run all function tests
bun test

# Watch mode
bun test --watch
```

**Expected Output:**

```
✓ Configuration validation (6 tests)
✓ Webhook signature verification (2 tests)
✓ checkout.session.completed event (30 tests)
✓ Error handling (15 tests)

Total: 53 tests passed
```

## Common Development Workflows

### Workflow 1: Test New User Creation

**Scenario:** Verify webhook creates a new user and member document

```bash
# 1. Ensure stripe listen is running (Terminal 2)
stripe listen --forward-to http://localhost:5001/doula-cooperative-test/us-central1/stripeWebhook --skip-verify

# 2. In another terminal, trigger a test event
stripe trigger checkout.session.completed

# 3. Verify in Firebase Emulator UI (localhost:4000)
# - Auth tab → Check for jenny.rosen@example.com
# - Firestore tab → members collection → Check for new document

# 4. Check function logs
# Look for:
# ✓ "Processing membership for: jenny.rosen@example.com"
# ✓ "Created user: <uid>"
# ✓ "Created member document"
```

### Workflow 2: Debug Webhook Processing

**Scenario:** Webhook isn't working as expected

```bash
# 1. Check function logs in real-time
firebase functions:log --only stripeWebhook --follow

# 2. Trigger event
stripe trigger checkout.session.completed

# 3. Look for error messages with ERROR_IDS
# Example output:
# ERROR: Webhook signature verification failed
# errorId: STRIPE_WEBHOOK_INVALID_SIGNATURE

# 4. Check Firestore for processed events
# Emulator UI → Firestore → processedStripeEvents collection
```

### Workflow 3: Clean Up Test Data

**Scenario:** After testing, remove test users and data

```bash
# Option 1: Manual cleanup via Emulator UI
# - Auth → Delete users
# - Firestore → members → Delete documents
# - Firestore → processedStripeEvents → Delete documents

# Option 2: Automated cleanup (once script is available)
cd functions
bun run cleanup-test-data --email-pattern "jenny.rosen@example.com"
```

### Workflow 4: Test with Different Emails

**Scenario:** Test webhook with your own test email

Currently, `stripe trigger` uses `jenny.rosen@example.com` by default. For custom emails, you need to:

```bash
# Option 1: Use the test script (once available)
cd functions
bun run test-webhook --email yourtest@example.com

# Option 2: Manually create checkout session via Stripe Dashboard
# 1. Stripe Dashboard → Test mode → Products
# 2. Create new checkout session with your test email
# 3. Complete checkout with test card 4242 4242 4242 4242
# 4. Webhook fires automatically if `stripe listen` is running
```

### Workflow 5: Verify Email Content

**Scenario:** Check welcome email formatting

```bash
# In emulator mode, emails are logged but not sent
# Check function logs for:
grep "Would have sent welcome email" # Shows email recipient
grep "Password reset link" # Shows the actual link

# To test actual email delivery:
# 1. Set valid MAILGUN_API_KEY in .env.local
# 2. Disable emulator mode (not recommended for local dev)
# 3. Or test in deployed environment
```

## Debugging Tips

### Issue: "stripe: command not found"

**Solution:**

```bash
# Install Stripe CLI
# macOS:
brew install stripe/stripe-cli/stripe

# Windows (using Scoop):
scoop install stripe

# Linux:
# See https://stripe.com/docs/stripe-cli#install
```

### Issue: "stripe listen" fails to connect

**Solution:**

```bash
# Re-authenticate
stripe login

# Use --skip-verify for local development
stripe listen --forward-to http://localhost:5001/PROJECT/us-central1/stripeWebhook --skip-verify
```

### Issue: Firebase emulators won't start

**Solution:**

```bash
# Check if ports are in use
lsof -i :5001 # Functions
lsof -i :8080 # Firestore
lsof -i :9099 # Auth

# Kill processes if needed
kill -9 <PID>

# Or use Firebase command
firebase emulators:kill

# Then restart
bun start
```

### Issue: "Missing signature" error

**Solution:**

- Ensure `stripe listen` is running
- Verify webhook URL matches emulator URL
- Check `.env.local` has correct `STRIPE_WEBHOOK_SECRET`
- For `stripe trigger`, the secret comes from `stripe listen` output

### Issue: User created but no member document

**Solution:**

```bash
# Check function logs for Firestore errors
firebase functions:log --only stripeWebhook | grep ERROR_IDS

# Common causes:
# 1. Firestore rules blocking writes (emulator rules are permissive)
# 2. Collection name mismatch
# 3. Function crashed after Auth but before Firestore write
```

### Issue: Email not sent in emulator

**Expected behavior!** In emulator mode (`FUNCTIONS_EMULATOR=true`), emails are logged but not sent. Check logs for:

```
"Emulator detected, skipping email dispatch"
"Would have sent welcome email to: <email>"
"Password reset link: <link>"
```

## IDE Setup

### VS Code

Recommended extensions:

- **Firebase** (firebase.vscode-firebase)
- **ESLint** (dbaeumer.vscode-eslint)
- **TypeScript and JavaScript Language Features** (built-in)

### Debugging Firebase Functions Locally

```bash
# Start emulators in inspect mode
firebase emulators:start --inspect-functions

# In VS Code, create .vscode/launch.json:
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "attach",
      "name": "Attach to Firebase Functions",
      "port": 9229
    }
  ]
}

# Set breakpoints in handler.ts
# Trigger webhook
# VS Code will pause at breakpoints
```

## Testing Checklist

Before committing code changes to Stripe webhook:

- [ ] Run all unit tests: `cd functions && bun test stripe-webhook.test.ts`
- [ ] Verify lint passes: `cd functions && bun run lint`
- [ ] Test new user creation locally with `stripe trigger`
- [ ] Test existing user update locally
- [ ] Check function logs for errors
- [ ] Verify Firestore documents have correct structure
- [ ] Clean up test data before pushing

## Common Commands Reference

```bash
# Development
bun start                      # Start all services
firebase emulators:start       # Start emulators only
bun run hugo:dev               # Hugo dev server only
bun run angular:start          # Angular dev server only

# Testing
cd functions && bun test stripe-webhook.test.ts  # Run Stripe tests
cd functions && bun test --watch                  # Watch mode
cd functions && bun run lint                      # Check linting

# Stripe CLI
stripe login                                      # Authenticate
stripe trigger checkout.session.completed        # Test event
stripe listen --forward-to URL --skip-verify     # Forward webhooks

# Firebase
firebase functions:log --only stripeWebhook      # View logs
firebase emulators:kill                           # Stop emulators
firebase deploy --only functions:stripeWebhook   # Deploy function

# Logs and Debugging
firebase functions:log --follow                   # Watch logs
firebase functions:log --only stripeWebhook --limit 50  # Recent logs
```

## Next Steps

- **New to the project?** Read the [Setup Guide](./SETUP.md) for initial configuration
- **Ready to test manually?** See the [Testing Guide](./TESTING_GUIDE.md) for 10 test scenarios
- **Hit an issue?** Check the [Troubleshooting Guide](./TROUBLESHOOTING.md)
- **Need quick reference?** See [Quick Reference](./QUICK_REFERENCE.md)

## Additional Resources

- [Stripe Testing Documentation](https://stripe.com/docs/testing)
- [Firebase Emulator Suite](https://firebase.google.com/docs/emulator-suite)
- [Stripe CLI Reference](https://stripe.com/docs/stripe-cli)
- [Project Guidelines](/CLAUDE.md)

---

**Questions?** Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) or ask in team chat.
