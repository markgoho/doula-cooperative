import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { ReferralDetail } from "./referral-schemas.js";
import { toFirstName } from "./to-first-name.js";
import { toReferralArea } from "./to-referral-area.js";

/**
 * Convert a Firestore match request document to the pre-Outreach Referral view.
 * Explicit member-facing allowlist: the requester's full name, email and phone
 * are never included, and future admin-only fields cannot leak.
 */
export function toReferralDetail(
  id: string,
  document: MatchRequestDocument,
): ReferralDetail {
  return {
    id,
    firstName: toFirstName(document.name),
    zipcode: document.zipcode,
    area: toReferralArea(document.zipcode),
    prefersSpanish: document.locale === "es",
    // No Outreach or Offline Responses are recorded yet.
    responseCount: 0,
    estimatedDueDate: document.estimatedDueDate,
    services: document.services,
    birthLocation: document.birthLocation,
    otherInfo: document.otherInfo,
    insurance: document.insurance,
    submitted: timestampToIso(document.submitted),
  };
}
