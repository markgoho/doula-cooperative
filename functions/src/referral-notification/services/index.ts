import type { ReferralNotificationStore as ReferralNotificationStoreInterface } from "../types/services.js";
import { getMatchRequest } from "./get-match-request.js";
import { listMembersWithLiveSubscription } from "./list-members-with-live-subscription.js";
import { markMemberNotificationSent } from "./mark-member-notification-sent.js";

/**
 * Firestore store for the Referral Notification trigger.
 * Each method lives in its own file to comply with the "one export per module" rule.
 */
export const ReferralNotificationStore: ReferralNotificationStoreInterface = {
  getMatchRequest,
  listMembersWithLiveSubscription,
  markMemberNotificationSent,
};
