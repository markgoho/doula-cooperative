import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { toMatchRequestResponse } from "../../admin-match-requests-api/schemas/match-request-schemas.js";
import type { ReferralDetail } from "./referral-schemas.js";

/**
 * Convert a Firestore match request document to a member-facing referral detail.
 * Delegates to the shared admin converter, then strips admin-only fields
 * (sent, recaptchaScore) that members should not see.
 */
export function toReferralDetail(
  id: string,
  document: MatchRequestDocument,
): ReferralDetail {
  const { sent: _sent, recaptchaScore: _recaptchaScore, ...detail } =
    toMatchRequestResponse(id, document);
  return detail;
}
