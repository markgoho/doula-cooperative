import type {
  MemberDocument,
  SubscriptionStatus,
} from "@doula-coop/functions-shared/collections/index.js";
import type { Timestamp } from "firebase-admin/firestore";

/**
 * Factory function to create member update data for adding Stripe subscription to existing member.
 * Ensures all required Stripe fields are present and valid.
 *
 * @param parameters - Object containing Stripe subscription fields
 * @returns Partial MemberDocument with Stripe fields for merge update
 * @throws Error if required fields are missing or invalid
 */
export function createStripeMemberUpdate(parameters: {
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
}): Partial<MemberDocument> {
  // Validate required Stripe fields
  if (!parameters.stripeCustomerId.startsWith("cus_")) {
    throw new Error(
      `Invalid Stripe customer ID: ${parameters.stripeCustomerId}`,
    );
  }

  if (!parameters.stripeSubscriptionId.startsWith("sub_")) {
    throw new Error(
      `Invalid Stripe subscription ID: ${parameters.stripeSubscriptionId}`,
    );
  }

  return {
    membershipActive: true,
    subscriptionStart: parameters.subscriptionStart,
    membershipExpiresAt: parameters.membershipExpiresAt,
    stripeCustomerId: parameters.stripeCustomerId,
    stripeSubscriptionId: parameters.stripeSubscriptionId,
    subscriptionStatus: parameters.subscriptionStatus,
  };
}
