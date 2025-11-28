# Stripe Webhook Troubleshooting Guide

Systematic debugging for common Stripe integration issues.

## Navigation

- [← Back to Stripe Docs](./README.md)
- [Local Development Guide](./LOCAL_DEVELOPMENT.md)
- [Testing Guide](./TESTING_GUIDE.md)
- [Production Monitoring](./PRODUCTION_MONITORING.md)
- [Quick Reference](./QUICK_REFERENCE.md)

---

## Quick Diagnostics

Before diving into specific issues, run these quick checks:

### 1. Is the webhook being received?

```bash
# Check Stripe Dashboard
# Dashboard → Developers → Webhooks → [Your endpoint] → Recent deliveries

# Check Firebase Functions logs
firebase functions:log --only stripeWebhook --limit 50
```

### 2. Is the function responding?

Look for HTTP status codes in logs or Stripe Dashboard:
- **200**: Success
- **400**: Bad request (signature, missing data)
- **500**: Server error (processing failure)

### 3. Quick Status Check

```bash
# Verify function is deployed
firebase functions:list | grep stripeWebhook

# Check recent errors
firebase functions:log --only stripeWebhook | grep ERROR_IDS

# Verify secrets are set
firebase functions:secrets:access STRIPE_API_KEY
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET
```

---

## Common Issues

### Issue: Webhook Not Firing

**Symptoms**: No logs in Firebase, no "Recent deliveries" in Stripe Dashboard

**Diagnostic Steps**:

1. **Verify webhook URL in Stripe Dashboard**:
   ```
   Expected: https://us-central1-YOUR-PROJECT.cloudfunctions.net/stripeWebhook
   ```
   - Go to Stripe Dashboard → Developers → Webhooks
   - Click on your endpoint
   - Verify URL matches deployed function

2. **Check if function is deployed**:
   ```bash
   firebase functions:list | grep stripeWebhook
   # Should show: stripeWebhook (HTTP trigger)
   ```

3. **Verify Stripe Dashboard is in correct mode**:
   - Test mode uses test keys and test webhooks
   - Live mode uses live keys and live webhooks
   - Check toggle in top-right of Stripe Dashboard

4. **Confirm event is enabled**:
   - Stripe Dashboard → Developers → Webhooks → Your endpoint
   - Under "Events to send", verify `checkout.session.completed` is checked

**Solutions**:

```bash
# Redeploy function
cd functions && bun run build
firebase deploy --only functions:stripeWebhook

# Update webhook URL in Stripe Dashboard if it changed

# Verify secrets are set
firebase functions:secrets:access STRIPE_API_KEY
```

---

### Issue: User Not Created

**Symptoms**: Webhook returns 200 but no user in Firebase Auth

**Diagnostic Steps**:

1. **Check function logs for errors**:
   ```bash
   firebase functions:log --only stripeWebhook | grep "ERROR_IDS"
   ```

2. **Verify customer email was collected**:
   - Check Stripe Dashboard → Customer → Email field
   - Verify Pricing Table has "Collect customer email" enabled

3. **Check Firebase Auth quotas**:
   - Spark plan: 10k new users/month
   - Firebase Console → Usage and billing

**Common Error IDs**:

| Error ID | Cause | Solution |
|----------|-------|----------|
| `STRIPE_WEBHOOK_MISSING_EMAIL` | No email in checkout session | Enable email collection in Pricing Table |
| `STRIPE_WEBHOOK_USER_CREATE_FAILED` | Firebase Auth error | Check quotas, verify permissions |
| `STRIPE_WEBHOOK_AUTH_LOOKUP_FAILED` | Permission issue | Verify service account permissions |

**Solutions**:

1. **Enable email collection** in Stripe Pricing Table:
   - Stripe Dashboard → Products → Pricing tables → Edit table
   - Enable "Collect customer email"
   - Save changes

2. **Check Firebase Auth quota** hasn't been exceeded:
   - Firebase Console → Usage tab
   - Upgrade plan if needed

3. **Verify service account permissions**:
   - Firebase Console → Project Settings → Service Accounts
   - Ensure service account has `auth.users.create` permission

---

### Issue: Member Document Not Created

**Symptoms**: User exists in Auth but no document in Firestore `members` collection

**Diagnostic Steps**:

1. **Check for orphaned user**:
   ```bash
   # Firebase Console → Authentication
   # Find user by email, note UID
   
   # Firebase Console → Firestore → members collection
   # Search for document with that UID
   ```

2. **Check function logs for Firestore errors**:
   ```bash
   firebase functions:log --only stripeWebhook | grep "MEMBER_DOC"
   ```

3. **Verify Firestore rules allow writes**:
   ```javascript
   // firestore.rules
   match /members/{userId} {
     allow create: if request.auth != null;
   }
   ```

**Solutions**:

1. **Check logs** for `STRIPE_WEBHOOK_MEMBER_DOC_CREATE_FAILED`:
   ```bash
   firebase functions:log --only stripeWebhook | grep "MEMBER_DOC_CREATE_FAILED"
   ```

2. **Verify Firestore rules**:
   - Firebase Console → Firestore Database → Rules
   - Ensure rules allow function to write

3. **Manually create document** if needed:
   ```javascript
   // Firebase Console → Firestore → members collection → Add document
   // Document ID: [auth user UID]
   {
     uid: "[auth UID]",
     email: "[customer_email]",
     membershipActive: true,
     stripeCustomerId: "[from Stripe]",
     stripeSubscriptionId: "[from Stripe]",
     subscriptionStatus: "active",
     subscriptionStart: [timestamp],
     membershipExpiresAt: [timestamp],
     createdAt: [timestamp],
     welcomeEmailStatus: "manual"
   }
   ```

---

### Issue: Email Not Sent

**Symptoms**: User created, member document exists, but no welcome email

**Diagnostic Steps**:

1. **Check member document for email status**:
   ```javascript
   // Firestore Console → members → [user UID]
   {
     welcomeEmailStatus: "sent" | "failed" | "pending",
     welcomeEmailError: "error message if failed"
   }
   ```

2. **Check function logs for Mailgun errors**:
   ```bash
   firebase functions:log --only stripeWebhook | grep "EMAIL_FAILED"
   ```

3. **Verify MAILGUN_API_KEY is configured**:
   ```bash
   firebase functions:secrets:access MAILGUN_API_KEY
   ```

**Solutions**:

1. **Verify Mailgun secret**:
   ```bash
   firebase functions:secrets:set MAILGUN_API_KEY
   # Paste your Mailgun API key
   firebase deploy --only functions:stripeWebhook
   ```

2. **Check Mailgun dashboard** for rejected emails:
   - Mailgun Console → Logs
   - Look for your customer's email address

3. **Verify email domain** is configured in Mailgun:
   - Mailgun Console → Sending → Domains
   - Ensure `doulacooperative.com` is verified

4. **Manually resend** via password reset:
   - User can click "Forgot Password" on members.doulacooperative.com
   - Or use Firebase Console → Auth → User → Send password reset email

---

### Issue: Duplicate Users Created

**Symptoms**: Same email has multiple Firebase Auth users

**Diagnostic Steps**:

1. **Check `processedStripeEvents` collection**:
   ```javascript
   // Firestore Console → processedStripeEvents
   // Search for event ID
   ```

2. **Review webhook logs** for timing issues:
   ```bash
   firebase functions:log --only stripeWebhook | grep "already processed"
   ```

3. **Check if idempotency is working**:
   - Should see "Event <id> already processed, skipping" in logs
   - If not, indicates a bug

**Prevention**:

Idempotency is handled automatically via Firestore `.create()` which atomically fails if document exists.

**Recovery**:

1. **Delete duplicate users** from Firebase Auth:
   - Firebase Console → Authentication
   - Find duplicates, delete all but one

2. **Keep the user** with the most complete member document

3. **Report bug** with logs if this occurs:
   - Indicates race condition or idempotency failure

---

### Issue: Signature Verification Failure

**Symptoms**: Webhook returns 400 "Webhook signature verification failed"

**Diagnostic Steps**:

1. **Verify webhook secret matches**:
   ```bash
   # Get current secret from Stripe Dashboard
   # Dashboard → Developers → Webhooks → [Endpoint] → Signing secret
   
   # Compare with Firebase secret
   firebase functions:secrets:access STRIPE_WEBHOOK_SECRET
   ```

2. **Check if using test vs live mode keys**:
   - Test webhooks need test signing secret
   - Live webhooks need live signing secret

**Solutions**:

1. **Update webhook secret**:
   ```bash
   firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
   # Paste the whsec_... value from Stripe Dashboard
   firebase deploy --only functions:stripeWebhook
   ```

2. **Ensure consistency**:
   - Test webhooks use test secret
   - Live webhooks use live secret
   - Never mix test and live credentials

---

## Local Development Issues

### Issue: "stripe: command not found"

**Solution**:

```bash
# Install Stripe CLI
# macOS:
brew install stripe/stripe-cli/stripe

# Windows (Scoop):
scoop install stripe

# Linux:
# See: https://stripe.com/docs/stripe-cli#install
```

---

### Issue: "stripe listen" fails to connect

**Diagnostic Steps**:

1. Check if logged in: `stripe login --interactive`
2. Verify network connectivity
3. Check firewall settings

**Solution**:

```bash
# Re-authenticate
stripe login --interactive

# Use --skip-verify for local development
stripe listen --forward-to http://localhost:5001/PROJECT/us-central1/stripeWebhook --skip-verify
```

---

### Issue: Firebase emulators won't start

**Diagnostic Steps**:

```bash
# Check if ports are in use
lsof -i :5001 # Functions
lsof -i :8080 # Firestore
lsof -i :9099 # Auth
lsof -i :4000 # Emulator UI
```

**Solution**:

```bash
# Kill Firebase processes
firebase emulators:kill

# Kill specific port if needed
kill -9 <PID>

# Restart
bun start
```

---

## Production Issues

### Issue: Webhooks Suddenly Stopped Working

**Emergency Checklist**:

- [ ] Check Stripe Dashboard webhook delivery status
- [ ] Check Firebase Functions health (Console → Functions)
- [ ] Verify function hasn't been accidentally deleted
- [ ] Check quotas (Functions: 125k/day on Spark plan)
- [ ] Review recent deployments for breaking changes

**Immediate Actions**:

```bash
# Check recent deployments
firebase functions:log --only stripeWebhook --since 24h

# Verify function is deployed
firebase functions:list | grep stripeWebhook

# Check for failing webhooks in Stripe
# Stripe Dashboard → Developers → Webhooks → Event deliveries → Failures
```

**Escalation**:

- Contact Firebase Support if function is unhealthy
- Check Stripe status page: [status.stripe.com](https://status.stripe.com)
- Review error logs for ERROR_IDs and stack traces

---

## Manual Recovery Procedures

### Manually Create User from Failed Webhook

**Scenario**: Webhook failed, but customer paid - need to manually set up account

**Steps**:

1. **Get event details** from Stripe Dashboard:
   - Dashboard → Developers → Webhooks → [Endpoint] → Events
   - Find the failed event
   - Note: `customer_email`, `customer_id`, `subscription_id`

2. **Create user in Firebase Auth**:
   - Firebase Console → Authentication → Add user
   - Email: `[customer_email]`
   - Password: Generate temporary password
   - **Send password reset email**

3. **Create member document in Firestore**:
   - Firestore Console → members collection → Add document
   - Document ID: `[auth user UID]`
   - Fields:
     ```javascript
     {
       uid: "[auth UID]",
       email: "[customer_email]",
       membershipActive: true,
       stripeCustomerId: "[from Stripe]",
       stripeSubscriptionId: "[from Stripe]",
       subscriptionStatus: "active",
       subscriptionStart: [current timestamp],
       membershipExpiresAt: [calculated - last day of current month next year],
       createdAt: [current timestamp],
       welcomeEmailStatus: "manual"
     }
     ```

4. **Send password reset email**:
   - Firebase Console → Authentication → Find user → Send password reset email
   - Or user can use "Forgot Password" flow

---

### Rollback Procedure

**Scenario**: New deployment broke webhooks

**Steps**:

```bash
# 1. Identify last working deployment
firebase functions:log --since 48h | grep "stripeWebhook"

# 2. Revert code changes
git revert [commit-hash]

# 3. Rebuild and redeploy
cd functions && bun run build
firebase deploy --only functions:stripeWebhook

# 4. Verify with test event
stripe trigger checkout.session.completed
firebase functions:log --only stripeWebhook --tail
```

---

## Performance Issues

### Issue: Slow Response Time (> 5 seconds)

**Diagnostic Steps**:

1. Check Firebase Console → Functions → stripeWebhook → Execution time
2. Look for slow external API calls (Stripe, Mailgun, Firestore)
3. Review cold start times

**Optimization Options**:

1. **Increase function memory** (reduces cold starts):
   ```typescript
   // functions/src/stripe-webhook/index.ts
   export const stripeWebhook = onRequest({
     memory: "512MB", // Default is 256MB
     secrets: [...STRIPE_SECRETS, "MAILGUN_API_KEY"],
   }, handler);
   ```

2. **Review lazy loading** (already implemented):
   - Webhook uses lazy imports for faster cold starts
   - No further optimization needed

3. **Check for hanging promises**:
   - Ensure all async operations complete
   - Review error handling paths

---

## Error ID Reference

Quick reference for all ERROR_IDs in the codebase:

| Error ID | Location | Description | Action |
|----------|----------|-------------|--------|
| `STRIPE_WEBHOOK_MISSING_SECRETS` | Configuration | API key or webhook secret not set | Set secrets, redeploy |
| `STRIPE_WEBHOOK_MISSING_SIGNATURE` | Request validation | No stripe-signature header | Ensure webhooks configured correctly |
| `STRIPE_WEBHOOK_INVALID_SIGNATURE` | Security | Signature verification failed | Update STRIPE_WEBHOOK_SECRET |
| `STRIPE_WEBHOOK_MISSING_EMAIL` | Data validation | No email in checkout session | Enable email collection in Pricing Table |
| `STRIPE_WEBHOOK_AUTH_LOOKUP_FAILED` | Firebase Auth | User lookup failed | Check Auth permissions, quotas |
| `STRIPE_WEBHOOK_USER_CREATE_FAILED` | Firebase Auth | User creation failed | Check quotas, permissions |
| `STRIPE_WEBHOOK_MEMBER_DOC_CREATE_FAILED` | Firestore | Member document creation failed | Check Firestore rules, quotas |
| `STRIPE_WEBHOOK_MEMBER_DOC_UPDATE_FAILED` | Firestore | Member document update failed | Check Firestore rules |
| `STRIPE_WEBHOOK_EMAIL_FAILED` | Mailgun | Email sending failed (non-critical) | Check Mailgun config, manual resend |
| `STRIPE_WEBHOOK_MAILGUN_NOT_CONFIGURED` | Configuration | MAILGUN_API_KEY not set | Set secret, redeploy |
| `STRIPE_WEBHOOK_PASSWORD_RESET_LINK_FAILED` | Firebase Auth | Password reset link generation failed | Check Auth configuration |
| `STRIPE_WEBHOOK_UNHANDLED_EVENT` | Event handling | Unrecognized event type | Expected for non-checkout events |
| `STRIPE_WEBHOOK_UNEXPECTED_ERROR` | General | Unexpected error condition | Review logs, file bug report |

---

## Getting Help

1. **Check function logs first**: `firebase functions:log --only stripeWebhook`
2. **Check Stripe webhook delivery logs**: Dashboard → Developers → Webhooks
3. **Review this guide** for your specific issue
4. **Check related documentation**:
   - [Setup Guide](./SETUP.md)
   - [Testing Guide](./TESTING_GUIDE.md)
   - [Production Monitoring](./PRODUCTION_MONITORING.md)
5. **Contact support** with:
   - Error ID from logs
   - Webhook event ID from Stripe
   - Steps to reproduce
   - Relevant log excerpts

---

**Pro Tip:** Most issues can be diagnosed in < 5 minutes by checking function logs and Stripe webhook delivery status first!
