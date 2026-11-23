import type { DecodedIdToken } from "firebase-admin/auth";
import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { canPreviewReferralPortal } from "./can-preview-referral-portal.js";
import { referralOpenCutoff } from "./referral-open-cutoff.js";

/**
 * Whether the requester may open this Referral's detail.
 *
 * The single place that decides the Referral window for the detail view:
 * - Admins and Referral Coordinators (preview roles) see every Referral.
 * - Everyone else sees a Referral only while it is open (under 14 days old).
 *
 * The "this Member sent Outreach on it" and "an Offline Response names them"
 * exceptions join here once Outreach is recorded.
 */
export function canViewReferral({
  decodedToken,
  document,
  now = new Date(),
}: {
  decodedToken: DecodedIdToken;
  document: Pick<MatchRequestDocument, "submitted">;
  now?: Date;
}): boolean {
  if (canPreviewReferralPortal(decodedToken)) return true;
  return document.submitted.toMillis() >= referralOpenCutoff(now).getTime();
}
