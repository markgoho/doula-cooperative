import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Whether the requester can reach the Referral Portal regardless of the
 * Referral Portal v2 switch and of Active Membership.
 *
 * The single place that decides preview access: Admins (`admin` claim) and
 * Referral Coordinators (`referralCoordinator` claim).
 */
export function canPreviewReferralPortal(
  decodedToken: DecodedIdToken,
): boolean {
  return (
    decodedToken["admin"] === true ||
    decodedToken["referralCoordinator"] === true
  );
}
