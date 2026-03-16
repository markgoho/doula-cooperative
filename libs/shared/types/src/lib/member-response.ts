import type { SubscriptionStatus } from "./subscription-status.js";
import type { WelcomeEmailStatus } from "./welcome-email-status.js";

/**
 * Member API response type.
 * Represents a member document as returned by the API.
 * All Timestamp fields are converted to ISO 8601 strings.
 *
 * IMPORTANT INVARIANTS:
 * - Stripe fields (stripeCustomerId, stripeSubscriptionId, subscriptionStatus):
 *   Either all three must be present OR all three must be absent.
 *   Partial Stripe data indicates a data integrity issue.
 *
 * - Newsletter state: Only one of newsletterSubscribedAt OR newsletterUnsubscribedAt
 *   should be set, never both. newsletterSubscribed boolean indicates current state.
 *
 * - Membership expiration: membershipExpiresAt should only be present when
 *   subscriptionStart exists (either from Stripe or manual membership).
 */
export interface MemberResponse {
  uid: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  name?: string;
  subscriptionStart?: string;
  membershipActive?: boolean;
  membershipExpiresAt?: string;
  slug?: string;
  profileCreatedAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  lastPayment?: string;
  nextPayment?: string;
  welcomeEmailStatus?: WelcomeEmailStatus;
  welcomeEmailSentAt?: string;
  welcomeEmailError?: string;
  newsletterSubscribed?: boolean;
  newsletterSubscribedAt?: string;
  newsletterUnsubscribedAt?: string;
  refundedAt?: string;
  refundReason?: string;
}
