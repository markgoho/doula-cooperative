import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { ReferralListItem } from "./referral-schemas.js";
import type { MemberResponsesSummary } from "./summarize-member-responses.js";
import { toReferralArea } from "./to-referral-area.js";

/**
 * Convert a Firestore match request document to a referral list item.
 * Explicit allowlist: no requester name or contact info, and the ZIP code
 * is reduced to a "City, ST" area.
 */
export function toReferralListItem(
  id: string,
  document: MatchRequestDocument,
  {
    responseCount,
    ownOutreachSentAt,
    isOpen,
  }: MemberResponsesSummary & { isOpen: boolean },
): ReferralListItem {
  return {
    id,
    submitted: timestampToIso(document.submitted),
    estimatedDueDate: document.estimatedDueDate,
    services: document.services,
    area: toReferralArea(document.zipcode),
    responseCount,
    isOpen,
    ...(ownOutreachSentAt && {
      outreach: { sentAt: timestampToIso(ownOutreachSentAt) },
    }),
  };
}
