```mermaid
sequenceDiagram
    actor User
    participant Hugo as Hugo Site<br/>(Pricing Table)
    participant Stripe as Stripe<br/>(Checkout & Webhooks)
    participant Function as Firebase Function<br/>(stripeWebhook)
    participant Auth as Firebase Auth
    participant Firestore as Firestore<br/>(members)
    participant Mailgun as Mailgun<br/>(Email)

    %% Happy Path - New User
    Note over User,Mailgun: Scenario: New Member Sign-Up

    User->>Hugo: Visit /join-the-doula-cooperative
    Hugo->>User: Display Stripe Pricing Table
    User->>Stripe: Click pricing option, complete checkout
    Note over User,Stripe: Test card: 4242 4242 4242 4242
    Stripe->>User: Redirect to success page

    Stripe->>Function: POST checkout.session.completed webhook
    Note over Stripe,Function: Headers: stripe-signature

    Function->>Function: Verify webhook signature
    alt Invalid Signature
        Function->>Stripe: 400 Bad Request
    end

    Function->>Firestore: Check processed events (idempotency)
    alt Event Already Processed
        Function->>Stripe: 200 OK (duplicate=true)
    end

    Function->>Firestore: Create processed event document

    Function->>Auth: getUserByEmail()
    alt User Doesn't Exist (New User)
        Function->>Function: Generate secure temp password
        Function->>Auth: createUser(email, password, name)
        Auth->>Function: Return UID

        Function->>Firestore: Create member document
        Note over Function,Firestore: Fields: uid, email, stripeCustomerId,<br/>stripeSubscriptionId, subscriptionStatus,<br/>membershipActive, expiresAt

        Function->>Auth: generatePasswordResetLink(email)
        Auth->>Function: Return reset link

        Function->>Mailgun: Send welcome email with reset link
        Mailgun->>User: Welcome email

        Function->>Firestore: Update member doc<br/>(welcomeEmailStatus: "sent")

        Function->>Stripe: 200 OK (emailSent=true)
    else User Already Exists (Renewal)
        Function->>Firestore: Update member document<br/>(merge: true)
        Note over Function,Firestore: Preserve existing fields like slug, name, etc.<br/>Update: subscriptionStatus, stripeCustomerId, etc.

        Function->>Stripe: 200 OK (emailSent=false)
        Note over Function,Stripe: No welcome email sent for existing users
    end

    User->>User: Check email inbox
    User->>Auth: Click password reset link
    Auth->>User: Show password setup page
    User->>Auth: Set new password
    Auth->>User: Password updated

    User->>Hugo: Navigate to members.doulacooperative.com
    User->>Auth: Sign in with email + password
    Auth->>User: Authentication successful
    User->>User: Access members portal

    %% Error Scenarios
    Note over User,Mailgun: Error Scenarios

    rect rgb(255, 240, 240)
        Note over Function,Mailgun: Email Failure (Non-Critical)
        Function->>Mailgun: Send welcome email
        Mailgun-->>Function: Error (API timeout, etc.)
        Function->>Firestore: Update member doc<br/>(welcomeEmailStatus: "failed")
        Function->>Stripe: 200 OK (emailSent=false)
        Note over Function,Stripe: User account created successfully<br/>Manual password reset available
    end

    rect rgb(255, 240, 240)
        Note over Function,Auth: Auth Failure (Critical)
        Function->>Auth: createUser()
        Auth-->>Function: Error (quota exceeded, etc.)
        Function->>Stripe: 500 Internal Server Error
        Note over Function,Stripe: ERROR_ID: STRIPE_WEBHOOK_USER_CREATE_FAILED<br/>Requires manual intervention
    end

    rect rgb(255, 240, 240)
        Note over Function,Firestore: Firestore Failure (Critical)
        Function->>Auth: createUser() ✓
        Function->>Firestore: Create member document
        Firestore-->>Function: Error (permissions, timeout, etc.)
        Function->>Stripe: 500 Internal Server Error
        Note over Function,Stripe: ERROR_ID: STRIPE_WEBHOOK_MEMBER_DOC_CREATE_FAILED<br/>Orphaned Auth user - requires manual document creation
    end
```

## Flow Description

### Happy Path - New User

1. **User Checkout**: User completes payment via Stripe Pricing Table on Hugo site
2. **Webhook Delivery**: Stripe sends `checkout.session.completed` event to Firebase Function
3. **Signature Verification**: Function verifies webhook signature for security
4. **Idempotency Check**: Function checks if event was already processed
5. **User Lookup**: Function checks if user exists in Firebase Auth
6. **User Creation**: For new users, generates secure temp password and creates Auth user
7. **Member Document**: Creates Firestore document with subscription details
8. **Welcome Email**: Sends email via Mailgun with password reset link
9. **Success Response**: Returns 200 OK to Stripe
10. **User Password Setup**: User clicks link in email and sets password
11. **Portal Access**: User signs in to members portal

### Happy Path - Existing User (Renewal)

1-5. Same as new user flow
6. **User Update**: For existing users, function recognizes email already exists
7. **Member Document Update**: Updates Firestore document with new subscription details (merge: true)
8. **Success Response**: Returns 200 OK to Stripe (no email sent)
9. **Existing Access**: User continues using existing credentials

### Error Scenarios

#### Email Failure (Non-Critical)
- User account created successfully
- Email fails to send (Mailgun error)
- Function still returns 200 OK to Stripe
- Member document marked with `welcomeEmailStatus: "failed"`
- User can manually request password reset

#### Auth Failure (Critical)
- User creation fails (quota exceeded, etc.)
- Function returns 500 error to Stripe
- Stripe will retry webhook (up to 3 days)
- Requires manual intervention if retries fail

#### Firestore Failure (Critical)
- User created in Auth successfully
- Member document creation fails
- Function returns 500 error to Stripe
- Creates orphaned Auth user
- Requires manual member document creation

## Key Security Features

- ✅ Webhook signature verification prevents unauthorized access
- ✅ Idempotency prevents duplicate user creation
- ✅ Temporary password never sent to user
- ✅ Password reset flow enforced via email
- ✅ HTTPS required for all Firebase Functions

## Monitoring Points

- 📊 Webhook success rate (target: >99%)
- 📊 Response time (target: p95 <2s)
- 📊 Email delivery rate (target: >95%)
- 📊 Error distribution by ERROR_ID

## Related Documentation

- [Setup Guide](../SETUP.md) - Initial configuration
- [Testing Guide](../TESTING_GUIDE.md) - Manual testing scenarios
- [Troubleshooting](../TROUBLESHOOTING.md) - Debug common issues
- [Production Monitoring](../PRODUCTION_MONITORING.md) - Observability
