# Stripe Webhook Function

This Firebase Function handles Stripe webhook events to automatically create user accounts when members purchase subscriptions.

## Function Signature

```typescript
export async function handler(request: Request, response: Response): Promise<void>
```

## Events Handled

- `checkout.session.completed` - Fired when a customer completes checkout

## Workflow

### When Stripe Sends Webhook

1. **Verify Signature** - Validates webhook authenticity using `STRIPE_WEBHOOK_SECRET`
2. **Extract Customer Data** - Gets email, customer ID, and subscription ID from session
3. **Check Existing User** - Looks up user by email in Firebase Auth
4. **Create or Update:**
   - **New User:** Creates Firebase Auth user with temporary password, creates member document, sends welcome email
   - **Existing User:** Updates member document with Stripe data and membership activation
5. **Send Response** - Returns success/error status to Stripe

## Environment Variables

Required secrets (set via `firebase functions:secrets:set`):

- `STRIPE_API_KEY` - Stripe secret key (sk_test_... or sk_live_...)
- `STRIPE_WEBHOOK_SECRET` - Webhook signing secret (whsec_...)
- `MAILGUN_API_KEY` - Required for sending welcome email (optional in emulator mode)

## Testing

### Local Testing with Stripe CLI

```bash
# Forward webhooks to local emulator
stripe listen --forward-to http://localhost:5001/PROJECT_ID/us-central1/stripeWebhook

# Trigger test event
stripe trigger checkout.session.completed
```

### Manual Testing

```bash
# Test with curl (requires valid signature)
curl -X POST http://localhost:5001/PROJECT_ID/us-central1/stripeWebhook \
  -H "Content-Type: application/json" \
  -H "stripe-signature: SIGNATURE" \
  -d @test-event.json
```

## Security

- ✅ **Signature Verification:** All webhooks verified using `stripe.webhooks.constructEvent()`
- ✅ **Secure Password Generation:** Uses `crypto.getRandomValues()` for temporary passwords
- ✅ **Idempotency:** Handles duplicate webhook deliveries gracefully
- ✅ **Error Handling:** Logs errors without exposing sensitive data

## Error Responses

- `400` - Missing signature header, invalid signature, or missing customer email
- `500` - Server configuration error (missing secrets) or internal processing error
- `200` - Success (webhook processed)

## Logging

All operations logged via `firebase-functions/v2/logger`:

- Info: User creation, member document updates, email sending
- Warn: Unhandled event types, missing Mailgun key
- Error: Signature verification failures, processing errors

## Database Changes

### Collections Modified

**`members` collection:**
- Creates new document with UID as key (for new users)
- Updates existing document (for existing users)

**Fields Set:**
```typescript
{
  uid: string;
  email: string;
  createdAt: Timestamp;
  membershipActive: true;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: 'active';
  name?: string;
}
```

## Email Template

Welcome email includes:
- Greeting with membership activation confirmation
- Password reset link (expires in 1 hour - Firebase Auth default)
- List of member benefits
- Contact information for support

**Note:** Password reset link expiration is controlled by Firebase Auth settings and defaults to 1 hour.

## Future Enhancements

- Handle `customer.subscription.updated` for renewals
- Handle `customer.subscription.deleted` for cancellations
- Add retry logic for failed email sends
- Implement webhook event logging to Firestore
- Support proration for mid-cycle upgrades
