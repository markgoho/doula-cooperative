/**
 * Members collection: stores member account data and subscription status
 */
export const MEMBERS_COLLECTION = "members";

// Re-export types from the canonical source to avoid duplication
export {
  hasValidStripeData,
  isActiveStripeMember,
  isStripeMember,
  type MemberDocument,
  type StripeMemberDocument,
  type SubscriptionStatus,
} from "../types/member-document.js";
