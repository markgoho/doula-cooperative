import type { DecodedIdToken } from "firebase-admin/auth";
import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { canPreviewReferralPortal } from "./can-preview-referral-portal.js";
import { referralOpenCutoff } from "./referral-open-cutoff.js";

/**
 * Whether the requester may open this Referral.
 *
 * The single place that decides the Referral window for the list and detail:
 * - Admins and Referral Coordinators (preview roles) see every Referral.
 * - A Member who sent Outreach on a Referral sees it at any age.
 * - Everyone else sees a Referral only while it is open (under 14 days old).
 *
 * The "an Offline Response names them" exception joins here once Offline
 * Responses are recorded.
 */
export function canViewReferral({
  decodedToken,
  document,
  hasOutreach,
  now = new Date(),
}: {
  decodedToken: DecodedIdToken;
  document: Pick<MatchRequestDocument, "submitted">;
  /** Whether the requester sent Outreach on this Referral. */
  hasOutreach: boolean;
  now?: Date;
}): boolean {
  if (canPreviewReferralPortal(decodedToken)) return true;
  if (hasOutreach) return true;
  return document.submitted.toMillis() >= referralOpenCutoff(now).getTime();
}
