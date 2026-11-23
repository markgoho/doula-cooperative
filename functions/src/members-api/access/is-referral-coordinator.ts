import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Whether the requester is a Referral Coordinator (`referralCoordinator` claim).
 *
 * The single place that reads the claim. Granted and revoked by an Admin,
 * independent of Active Membership.
 */
export function isReferralCoordinator(decodedToken: DecodedIdToken): boolean {
  return decodedToken["referralCoordinator"] === true;
}
