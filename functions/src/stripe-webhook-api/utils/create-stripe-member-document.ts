import type {
  StripeMemberDocument,
  SubscriptionStatus,
} from "@doula-coop/functions-shared/collections/index.js";
import { Timestamp } from "firebase-admin/firestore";

/**
 * Factory function to create a member document for a user with a Stripe subscription.
 * Ensures all required Stripe fields are present and valid.
 *
 * @param parameters - Object containing all required Stripe member fields
 * @returns A valid StripeMemberDocument with all invariants enforced
 * @throws Error if required fields are missing or invalid
 */
export function createStripeMemberDocument(parameters: {
  uid: string;
  email: string;
  stripeCustomerId: string;
  stripeSubscriptionId: string;
  subscriptionStatus: SubscriptionStatus;
  subscriptionStart: Timestamp;
  membershipExpiresAt: Timestamp;
  name?: string;
}): StripeMemberDocument {
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

  const document: StripeMemberDocument = {
    uid: parameters.uid,
    email: parameters.email,
    createdAt: Timestamp.now(),
    membershipActive: true,
    subscriptionStart: parameters.subscriptionStart,
    membershipExpiresAt: parameters.membershipExpiresAt,
    stripeCustomerId: parameters.stripeCustomerId,
    stripeSubscriptionId: parameters.stripeSubscriptionId,
    subscriptionStatus: parameters.subscriptionStatus,
  };

  if (parameters.name) {
    document.name = parameters.name;
  }

  return document;
}
