import { Timestamp } from "firebase-admin/firestore";

/**
 * Members collection: stores member account data and subscription status
 */
export const MEMBERS_COLLECTION = "members";

export type SubscriptionStatus =
  | "active"
  | "past_due"
  | "canceled"
  | "incomplete"
  | "trialing"
  | "unpaid";

/**
 * Member document stored in Firestore.
 *
 * INVARIANTS:
 * 1. Stripe Consistency: If any Stripe field is set, all three must be set:
 *    - stripeCustomerId, stripeSubscriptionId, subscriptionStatus
 * 2. Active Membership: membershipActive should be true only if:
 *    - subscriptionStatus is "active" or "trialing" (for Stripe members), OR
 *    - membershipExpiresAt is in the future (for legacy members)
 * 3. Subscription Start: If subscription is active, subscriptionStart must be set
 * 4. Expiration: If membershipActive is true, membershipExpiresAt should be set
 *
 * Member Types:
 * - Stripe Member: Has stripeCustomerId, stripeSubscriptionId, subscriptionStatus
 * - Legacy Member: Has subscriptionStart and membershipExpiresAt but no Stripe fields
 * - New Member: Has only basic fields (uid, email, createdAt, membershipActive=false)
 */
export interface MemberDocument {
  createdAt: Timestamp;
  email: string;
  uid: string;
  name?: string;
  subscriptionStart?: Timestamp;
  membershipActive?: boolean;
  membershipExpiresAt?: Timestamp;
  slug?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  welcomeEmailStatus?: "sent" | "failed" | "pending";
  welcomeEmailSentAt?: Timestamp;
  welcomeEmailError?: string;
}

/**
 * Type guard for documents with Stripe subscription data.
 */
export interface StripeMemberDocument extends MemberDocument {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStart: Timestamp;
  membershipActive: boolean;
  membershipExpiresAt: Timestamp;
}

/**
 * Checks if a member document has Stripe subscription fields.
 */
export function isStripeMember(
  document: MemberDocument,
): document is StripeMemberDocument {
  return !!(
    document.stripeCustomerId &&
    document.stripeSubscriptionId &&
    document.subscriptionStatus &&
    document.subscriptionStart &&
    document.membershipExpiresAt !== undefined
  );
}

/**
 * Validates that Stripe fields are all present or all absent (consistency check).
 */
export function hasValidStripeData(document: MemberDocument): boolean {
  const hasAll = !!(
    document.stripeCustomerId &&
    document.stripeSubscriptionId &&
    document.subscriptionStatus
  );
  const hasNone = !(
    document.stripeCustomerId ??
    document.stripeSubscriptionId ??
    document.subscriptionStatus
  );
  return hasAll || hasNone;
}

/**
 * Checks if a member has an active Stripe subscription.
 */
export function isActiveStripeMember(document: MemberDocument): boolean {
  return (
    isStripeMember(document) &&
    (document.subscriptionStatus === "active" ||
      document.subscriptionStatus === "trialing")
  );
}
