import type { DecodedIdToken } from "firebase-admin/auth";

/**
 * Whether the requester can reach the Referral Portal regardless of the
 * Referral Portal v2 switch and of Active Membership.
 *
 * The single place that decides preview access: Referral Coordinators
 * (`referralCoordinator` claim) join Admins here in a later slice.
 */
export function canPreviewReferralPortal(
  decodedToken: DecodedIdToken,
): boolean {
  return decodedToken["admin"] === true;
}
