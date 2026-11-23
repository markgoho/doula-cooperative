import type { DecodedIdToken } from "firebase-admin/auth";
import { isReferralCoordinator } from "./is-referral-coordinator.js";

/**
 * Whether the requester may list the doulas and record Offline Responses.
 *
 * The single place that decides it: Referral Coordinators only. An Admin
 * without the claim sees Offline Responses but does not record them.
 */
export function canRecordOfflineResponses(
  decodedToken: DecodedIdToken,
): boolean {
  return isReferralCoordinator(decodedToken);
}
