import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { ReferralListItem } from "./referral-schemas.js";
import type { MemberResponsesSummary } from "./summarize-member-responses.js";
import { toOutcomeFields } from "./to-outcome-fields.js";
import { toReferralArea } from "./to-referral-area.js";

/**
 * Convert a Firestore match request document to a referral list item.
 * Explicit allowlist: no requester name or contact info, and the ZIP code
 * is reduced to a "City, ST" area. Carries the viewer's own Referral Outcome
 * and the hired badge, never other Members' names or non-hired Outcomes.
 */
export function toReferralListItem(
  id: string,
  document: MatchRequestDocument,
  { isOpen, ...summary }: MemberResponsesSummary & { isOpen: boolean },
): ReferralListItem {
  const { responseCount, ownOutreachSentAt, ownOfflineResponse } = summary;
  const { outcome, hiredBadge } = toOutcomeFields(summary);
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
    ...(ownOfflineResponse && {
      offlineResponse: {
        recordedAt: timestampToIso(ownOfflineResponse.recordedAt),
      },
    }),
    ...(outcome && { outcome }),
    hiredBadge,
  };
}
