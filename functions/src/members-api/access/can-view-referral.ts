import type { DecodedIdToken } from "firebase-admin/auth";
import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { canPreviewReferralPortal } from "./can-preview-referral-portal.js";
import { isReferralOpen } from "./is-referral-open.js";

/**
 * Whether the requester may open this Referral.
 *
 * The single place that decides the Referral window for the list and detail:
 * - Admins and Referral Coordinators (preview roles) see every Referral.
 * - A Member who sent Outreach on a Referral, or whom an Offline Response
 *   names, sees it at any age.
 * - Everyone else sees a Referral only while it is open (under 14 days old).
 */
export function canViewReferral({
  decodedToken,
  document,
  hasOwnResponse,
  now = new Date(),
}: {
  decodedToken: DecodedIdToken;
  document: Pick<MatchRequestDocument, "submitted">;
  /** Whether the requester sent Outreach on this Referral or an Offline Response names them. */
  hasOwnResponse: boolean;
  now?: Date;
}): boolean {
  if (canPreviewReferralPortal(decodedToken)) return true;
  if (hasOwnResponse) return true;
  return isReferralOpen(document, now);
}
