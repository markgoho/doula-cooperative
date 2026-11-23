import type { NoOutreachAlertStore as NoOutreachAlertStoreInterface } from "../types/services.js";
import { listMatchRequestsNotifiedBetween } from "./list-match-requests-notified-between.js";
import { listReferralResponses } from "./list-referral-responses.js";
import { markNoOutreachAlertSent } from "./mark-no-outreach-alert-sent.js";

/**
 * Firestore store for the No-Outreach Alert sweep.
 * Each method lives in its own file to comply with the "one export per module" rule.
 */
export const NoOutreachAlertStore: NoOutreachAlertStoreInterface = {
  listMatchRequestsNotifiedBetween,
  listReferralResponses,
  markNoOutreachAlertSent,
};
