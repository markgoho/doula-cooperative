import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { ReferralDetail } from "./referral-schemas.js";
import type { MemberResponsesSummary } from "./summarize-member-responses.js";
import { toFirstName } from "./to-first-name.js";
import { toOutcomeFields } from "./to-outcome-fields.js";
import { toReferralArea } from "./to-referral-area.js";

/**
 * Convert a Firestore match request document to the member-facing Referral view.
 * Explicit allowlist so future admin-only fields cannot leak:
 * - Before the viewer's own Outreach, the requester's full name, email and
 *   phone are never included; `outreachSender` feeds the composer.
 * - After it, `outreach` (sent time) and `contact` are added.
 * - The viewer's own Referral Outcome and the hired badge are always included;
 *   other Members' names and non-hired Outcomes never are.
 */
export function toReferralDetail(
  id: string,
  document: MatchRequestDocument,
  {
    outreachSender,
    ...summary
  }: MemberResponsesSummary & {
    outreachSender: ReferralDetail["outreachSender"];
  },
): ReferralDetail {
  const { responseCount, ownOutreachSentAt } = summary;
  const base: ReferralDetail = {
    id,
    firstName: toFirstName(document.name),
    zipcode: document.zipcode,
    area: toReferralArea(document.zipcode),
    prefersSpanish: document.locale === "es",
    responseCount,
    estimatedDueDate: document.estimatedDueDate,
    services: document.services,
    birthLocation: document.birthLocation,
    otherInfo: document.otherInfo,
    insurance: document.insurance,
    submitted: timestampToIso(document.submitted),
    ...toOutcomeFields(summary),
  };

  if (ownOutreachSentAt) {
    return {
      ...base,
      outreach: { sentAt: timestampToIso(ownOutreachSentAt) },
      contact: {
        fullName: document.name,
        email: document.email,
        phone: document.phone,
      },
    };
  }

  return outreachSender ? { ...base, outreachSender } : base;
}
