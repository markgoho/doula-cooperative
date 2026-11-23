import type { DecodedIdToken } from "firebase-admin/auth";
import { isReferralCoordinator } from "./is-referral-coordinator.js";

/**
 * Whether the requester may see who sent Outreach on a Referral and each
 * Member's Referral Outcome (the Coordinator panel on the detail).
 *
 * The single place that decides it: Referral Coordinators and Admins.
 * Ordinary Members only ever see the count and the hired badge.
 */
export function canViewReferralResponses(
  decodedToken: DecodedIdToken,
): boolean {
  return decodedToken["admin"] === true || isReferralCoordinator(decodedToken);
}
