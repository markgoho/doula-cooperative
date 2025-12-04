# Stripe Webhook Production Monitoring

Observability, alerting, and incident response for the Stripe integration.

## Navigation

- [← Back to Stripe Docs](./README.md)
- [Troubleshooting Guide](./TROUBLESHOOTING.md) - Debug issues
- [Testing Guide](./TESTING_GUIDE.md) - Manual testing
- [Quick Reference](./QUICK_REFERENCE.md) - Cheat sheet

---

## Key Metrics to Monitor

### 1. Webhook Success Rate

**Target**: > 99%

**Where to Check**:

- Stripe Dashboard → Developers → Webhooks → [Endpoint] → Success rate
- Firebase Console → Functions → stripeWebhook → Metrics

**Alert Thresholds**:

- ⚠️ Warning: < 98% success rate over 1 hour
- 🚨 Critical: < 95% success rate over 15 minutes

### 2. User Creation Success Rate

**Target**: 100% (should match webhook success rate)

**How to Measure**:

- Compare successful webhooks to new Auth users created
- Check `welcomeEmailStatus` field distribution in Firestore

**Alert Thresholds**:

- ⚠️ Warning: Any failed user creation
- 🚨 Critical: Multiple failed creations in 1 hour

### 3. Response Time

**Target**: p95 < 2 seconds

**Where to Check**:

- Firebase Console → Functions → stripeWebhook → Execution time

**Alert Thresholds**:

- ⚠️ Warning: p95 > 3 seconds
- 🚨 Critical: p95 > 5 seconds

### 4. Email Delivery Rate

**Target**: > 95%

**How to Measure**:

```javascript
// Firestore query
members collection
where welcomeEmailStatus == "sent" vs "failed"
count over last 24 hours
```

**Alert Thresholds**:

- ⚠️ Warning: < 95% over 24 hours
- 🚨 Critical: < 90% over 1 hour

---

## Firebase Console Monitoring

### Logs Queries

**All webhook invocations**:

```
resource.type="cloud_function"
resource.labels.function_name="stripeWebhook"
severity>=DEFAULT
```

**Errors only**:

```
resource.type="cloud_function"
resource.labels.function_name="stripeWebhook"
severity>=ERROR
```

**Search for specific email**:

```
resource.type="cloud_function"
resource.labels.function_name="stripeWebhook"
jsonPayload.email="user@example.com"
```

**Search by ERROR_ID**:

```
resource.type="cloud_function"
resource.labels.function_name="stripeWebhook"
jsonPayload.errorId="STRIPE_WEBHOOK_USER_CREATE_FAILED"
```

### Firestore Monitoring Queries

**Failed email deliveries (last 24h)**:

```javascript
collection: members
where: welcomeEmailStatus == "failed"
where: createdAt > (now - 24h)
order by: createdAt desc
```

**Recent sign-ups**:

```javascript
collection: members
where: createdAt > (now - 24h)
order by: createdAt desc
```

**Active memberships count**:

```javascript
collection: members;
where: membershipActive == true;
where: membershipExpiresAt > now;
count;
```

**Orphaned users (Auth but no member doc)**:

```javascript
// Manual check:
// 1. Export all Auth user UIDs
// 2. Query members collection
// 3. Find UIDs missing from members
```

---

## Stripe Dashboard Monitoring

### Webhook Delivery Monitoring

**Location**: Dashboard → Developers → Webhooks → [Your endpoint]

**Check Daily**:

1. Success rate over last 24h
2. Recent deliveries (any 400/500 responses?)
3. Response time trends
4. Events currently being retried

**Weekly Review**:

1. Total events processed
2. Failed event details and patterns
3. Retry attempts and outcomes
4. Average response time trend

### Event History

**Useful Searches**:

```
# Events for specific customer
Search: customer email or ID

# Failed checkouts
Filter: checkout.session with incomplete status

# Subscription events (future)
Filter: customer.subscription.*
```

---

## Alert Configuration

### Firebase Alerts (via Cloud Monitoring)

**Setup**:

1. Go to Cloud Console → Monitoring → Alerting
2. Create new alert policy
3. Configure conditions and notifications

**Recommended Alerts**:

#### Alert 1: High Error Rate 🚨

```yaml
Metric: cloud_function/execution_count
Filter: function_name="stripeWebhook"
  AND status="error"
Condition: Rate > 5 errors/minute for 5 minutes
Notification: Email + SMS
```

#### Alert 2: Slow Response Time ⚠️

```yaml
Metric: cloud_function/execution_times
Filter: function_name="stripeWebhook"
Condition: 95th percentile > 5 seconds for 10 minutes
Notification: Email
```

#### Alert 3: Low Execution Count (Possible Outage) 🚨

```yaml
Metric: cloud_function/execution_count
Filter: function_name="stripeWebhook"
Condition: Count < 1 over 6 hours
Note: Adjust based on typical volume
Notification: Email + SMS
```

#### Alert 4: High Cold Start Rate ⚠️

```yaml
Metric: cloud_function/execution_count
Filter:
  function_name="stripeWebhook"
  AND instance_state="cold"
Condition: > 50% of executions are cold starts
Notification: Email
```

### Stripe Webhook Failure Notifications

**Setup**:

1. Stripe Dashboard → Settings → Webhook settings
2. Enable "Email notifications for webhook failures"
3. Add team email addresses

**Notification Triggers**:

- Individual webhook delivery failure
- Multiple consecutive failures (>3)
- Webhook disabled due to repeated failures (automatic at ~5% failure rate)

---

## Daily Monitoring Checklist

### Quick Health Check (5 minutes)

```bash
# 1. Check for any errors in last 24h
firebase functions:log --only stripeWebhook --since 24h | grep ERROR_IDS

# 2. Count successful vs failed invocations
firebase functions:log --only stripeWebhook --since 24h | grep "received: true" | wc -l

# 3. Check email delivery status
firebase functions:log --only stripeWebhook --since 24h | grep "Welcome email sent"
```

### Dashboard Checks

- [ ] Stripe Dashboard → Webhooks → Success rate > 99%
- [ ] Firebase Console → Functions → No red indicators
- [ ] No alert emails received
- [ ] Response time < 2s p95

---

## Weekly Metrics

Track these metrics weekly in a spreadsheet or dashboard:

| Week Of    | New Members | Webhook Success % | Avg Response Time | Email Success % | Issues            |
| ---------- | ----------- | ----------------- | ----------------- | --------------- | ----------------- |
| 2025-01-06 | 15          | 100%              | 1.2s              | 100%            | None              |
| 2025-01-13 | 22          | 99.5%             | 1.4s              | 95%             | 1 Mailgun timeout |

**How to Collect**:

```bash
# New members this week
# Firestore query: members where createdAt > (week start)

# Webhook success rate
# Stripe Dashboard → Webhooks → [Endpoint] → Analytics

# Avg response time
# Firebase Console → Functions → Execution time metrics

# Email success rate
# Firestore query: count(welcomeEmailStatus == "sent") / count(all new members)
```

---

## Incident Response Playbook

### Severity Levels

| Severity             | Description      | Response Time | Examples                            |
| -------------------- | ---------------- | ------------- | ----------------------------------- |
| 🚨 **P0 - Critical** | Complete outage  | < 15 minutes  | No webhooks processing, all failing |
| ⚠️ **P1 - High**     | Partial outage   | < 1 hour      | >10% failure rate, slow responses   |
| 📝 **P2 - Medium**   | Degraded service | < 4 hours     | Email failures, isolated issues     |
| ℹ️ **P3 - Low**      | Minor issue      | < 24 hours    | Single failed webhook, recovered    |

### P0 - Critical Outage Response

**Scenario**: No webhooks processing successfully

#### Immediate Actions (< 5 minutes)

```bash
# 1. Verify outage
firebase functions:log --only stripeWebhook --since 30m | grep "received: true"

# 2. Check function health
firebase functions:list | grep stripeWebhook

# 3. Check Stripe Dashboard
# Dashboard → Developers → Webhooks → Delivery status
```

#### Investigation (< 15 minutes)

```bash
# 1. Check recent deployments
firebase functions:log --only stripeWebhook --since 2h | head -100

# 2. Verify secrets
firebase functions:secrets:access STRIPE_API_KEY
firebase functions:secrets:access STRIPE_WEBHOOK_SECRET

# 3. Test locally
stripe trigger checkout.session.completed
# Watch Firebase emulator logs
```

#### Resolution

**If recent deployment broke it:**

```bash
# Rollback
git revert [commit-hash]
cd functions && bun run build
firebase deploy --only functions:stripeWebhook
```

**If secrets are wrong:**

```bash
# Update secrets
firebase functions:secrets:set STRIPE_API_KEY
firebase functions:secrets:set STRIPE_WEBHOOK_SECRET
firebase deploy --only functions:stripeWebhook
```

**If function is down:**

```bash
# Redeploy
cd functions && bun run build
firebase deploy --only functions:stripeWebhook
```

#### Cleanup (< 30 minutes)

```bash
# 1. Manually retry failed webhooks from Stripe Dashboard
# Dashboard → Developers → Webhooks → Failed events → Retry

# 2. Verify resolution
# Monitor logs for 15 minutes for successful events

# 3. Send status update to team
```

---

### P1 - High Severity Response

**Scenario**: Some webhooks failing (>10% failure rate)

#### Immediate Actions (< 30 minutes)

```bash
# 1. Identify pattern
firebase functions:log --only stripeWebhook --since 1h | grep ERROR_IDS

# 2. Check if specific to certain emails/domains
# 3. Verify external dependencies (Mailgun, Stripe API status)
```

#### Investigation (< 1 hour)

1. Review failed webhook details in Stripe Dashboard
2. Check if quota exceeded (Auth, Firestore, Functions)
3. Check for rate limiting from external APIs
4. Review recent code changes

#### Resolution

- Fix root cause (update secrets, increase quotas, fix bugs)
- Manually process failed webhooks if needed
- Monitor for 1 hour to confirm fix

---

### P2 - Medium Severity Response

**Scenario**: Email failures but user accounts created successfully

#### Assessment (< 1 hour)

```bash
# 1. Check scope
# Firestore query: members where welcomeEmailStatus == "failed"

# 2. Check Mailgun status and logs
# Mailgun Dashboard → Logs

# 3. Review member documents
```

#### Resolution (< 4 hours)

```bash
# 1. Fix Mailgun issue if applicable
firebase functions:secrets:set MAILGUN_API_KEY
firebase deploy --only functions:stripeWebhook

# 2. Manually send password reset links to affected users
# Firebase Console → Authentication → User → Send password reset email

# 3. Update member documents
# Firestore: set welcomeEmailStatus = "manual_resend"
```

---

## Performance Optimization

### Current Performance Baseline

- **Cold start**: ~800ms (first invocation)
- **Warm execution**: ~200-400ms (subsequent)
- **P95**: < 1.5 seconds
- **Memory usage**: ~120MB (256MB allocated)

### If Performance Degrades

#### Diagnostic Steps

```bash
# 1. Check execution time distribution
# Firebase Console → Functions → Execution time histogram

# 2. Review function logs for slow operations
firebase functions:log --only stripeWebhook --since 1h | grep "duration"

# 3. Check external API latency
# - Stripe API calls
# - Firestore read/write
# - Mailgun API calls
# - Firebase Auth operations
```

#### Optimization Options

**1. Increase function memory** (improves CPU allocation):

```typescript
// functions/src/stripe-webhook/index.ts
export const stripeWebhook = onRequest(
  {
    memory: "512MB", // Up from 256MB
    secrets: [...STRIPE_SECRETS, "MAILGUN_API_KEY"],
  },
  handler,
);
```

**2. Optimize cold starts** (already implemented):

- ✅ Lazy loading with dynamic imports
- ✅ Minimal dependencies
- ✅ Tree-shaking enabled

**3. Review external call optimization**:

- Consider caching Stripe API responses (if applicable)
- Batch Firestore operations (already optimal)
- Review Mailgun timeout settings

---

## Disaster Recovery

### Backup and Recovery Strategy

**Firestore Data**:

- Automated backups: Configure in Firebase Console → Firestore → Backups
- Recovery: Import from backup if data loss occurs

**Stripe Data**:

- Stripe maintains all subscription data
- Can reconcile from Stripe if Firestore data is lost

**Recovery Procedure**:

1. **Identify missing/corrupted data** in Firestore
2. **Export Stripe subscription data** via Dashboard or API
3. **Recreate member documents** using manual recovery procedure
4. **Verify data integrity** via spot checks

---

## Long-Term Monitoring Strategy

### Quarterly Reviews (every 3 months)

- [ ] Review all alert thresholds (still appropriate?)
- [ ] Analyze trends in sign-up volume and adjust capacity
- [ ] Review error patterns and add defensive code
- [ ] Update runbooks with new scenarios encountered
- [ ] Review and optimize function performance
- [ ] Audit secrets rotation (best practice: rotate annually)

### Annual Reviews (once per year)

- [ ] Review Stripe subscription lifecycle handling
- [ ] Consider adding more webhook event types:
  - `customer.subscription.updated` for renewals
  - `customer.subscription.deleted` for cancellations
  - `invoice.payment_failed` for failed payments
- [ ] Evaluate need for advanced monitoring (OpenTelemetry, Datadog, etc.)
- [ ] Review disaster recovery procedures and test recovery
- [ ] Audit Firebase quotas and upgrade plan if needed

---

## Monitoring Dashboard (Future Enhancement)

**Consider building a custom dashboard with**:

- Real-time webhook success rate
- Recent sign-ups (last 24h, 7d, 30d)
- Email delivery status
- Response time trends
- Error distribution by ERROR_ID
- Active vs. expired memberships
- MRR (Monthly Recurring Revenue) trend

**Tools to consider**:

- Firebase Extensions for analytics
- Looker Studio / Data Studio for visualization
- Custom Angular dashboard in members portal

---

## Resources

- [Firebase Monitoring Documentation](https://firebase.google.com/docs/functions/monitoring)
- [Stripe Webhook Best Practices](https://stripe.com/docs/webhooks/best-practices)
- [Google Cloud Monitoring](https://cloud.google.com/monitoring/docs)
- [Stripe Webhook Testing](https://stripe.com/docs/webhooks/test)

---

**Questions?** Check the [Troubleshooting Guide](./TROUBLESHOOTING.md) for specific issues or review function logs for ERROR_IDs.
