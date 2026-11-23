import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { ReferralDetail } from "./referral-schemas.js";
import type { MemberResponsesSummary } from "./summarize-member-responses.js";
import { toFirstName } from "./to-first-name.js";
import { toReferralArea } from "./to-referral-area.js";

/**
 * Convert a Firestore match request document to the member-facing Referral view.
 * Explicit allowlist so future admin-only fields cannot leak:
 * - Before the viewer's own Outreach, the requester's full name, email and
 *   phone are never included; `outreachSender` feeds the composer.
 * - After it, `outreach` (sent time) and `contact` are added.
 */
export function toReferralDetail(
  id: string,
  document: MatchRequestDocument,
  {
    responseCount,
    ownOutreachSentAt,
    outreachSender,
  }: MemberResponsesSummary & {
    outreachSender: ReferralDetail["outreachSender"];
  },
): ReferralDetail {
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
