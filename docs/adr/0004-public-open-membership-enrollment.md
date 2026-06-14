---
status: accepted (supersedes ADR-0003)
---

# Public open membership enrollment

Membership enrollment is now open to the public: any visitor can register from the Hugo site by completing a Stripe subscription checkout, which creates their member account on **Checkout Completion**. This reverses ADR-0003's invite-only model (no more invite access key). Consequently, a "new member signup" is canonically defined as a new Stripe-backed membership starting (a `Member` keyed by `subscriptionStart`), and this is the growth metric tracked on the Analytics Dashboard.
