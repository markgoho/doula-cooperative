/**
 * Subscription status values for member subscriptions.
 * Shared between backend (Firestore documents, API schemas) and frontend (UI display).
 */
export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "trialing"
  | "unpaid"
  | "refunded";
