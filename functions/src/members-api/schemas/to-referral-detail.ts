import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { ReferralDetail } from "./referral-schemas.js";

/**
 * Convert a Firestore match request document to a member-facing referral detail.
 * Explicit member-facing allowlist — only named fields are included,
 * so future admin-only fields cannot leak.
 */
export function toReferralDetail(
  id: string,
  document: MatchRequestDocument,
): ReferralDetail {
  return {
    id,
    name: document.name,
    email: document.email,
    phone: document.phone,
    zipcode: document.zipcode,
    estimatedDueDate: document.estimatedDueDate,
    services: document.services,
    birthLocation: document.birthLocation,
    otherInfo: document.otherInfo,
    insurance: document.insurance,
    submitted: timestampToIso(document.submitted),
  };
}
