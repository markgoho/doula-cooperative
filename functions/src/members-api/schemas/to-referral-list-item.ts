import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { ReferralListItem } from "./referral-schemas.js";

/**
 * Convert a Firestore match request document to a referral list item.
 * Omits contact info — detail endpoint provides full data.
 */
export function toReferralListItem(
  id: string,
  document: MatchRequestDocument,
): ReferralListItem {
  return {
    id,
    submitted: timestampToIso(document.submitted),
    estimatedDueDate: document.estimatedDueDate,
    services: document.services,
    zipcode: document.zipcode,
    birthLocation: document.birthLocation,
  };
}
