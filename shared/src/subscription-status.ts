export const SUBSCRIPTION_STATUSES = [
  "active",
  "past_due",
  "canceled",
  "incomplete",
  "trialing",
  "unpaid",
  "refunded",
] as const;

export type SubscriptionStatus = (typeof SUBSCRIPTION_STATUSES)[number];
