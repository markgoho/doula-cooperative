import { Timestamp } from "firebase-admin/firestore";
import {
  type MemberDocument,
  type StripeMemberDocument,
  type SubscriptionStatus,
} from "../types/member-document.js";

/**
 * Factory function to create a new member document for a user who just signed up.
 * This creates a basic member with no active membership.
 *
 * @param uid - Firebase Auth UID
 * @param email - User's email address
 * @param name - Optional display name
 * @returns A valid MemberDocument with membershipActive: false
 */
export function createNewMemberDocument(
  uid: string,
  email: string,
  name?: string,
): MemberDocument {
  const document: MemberDocument = {
    uid,
    email,
    createdAt: Timestamp.now(),
    membershipActive: false,
  };

  if (name) {
    document.name = name;
  }

  return document;
}

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
