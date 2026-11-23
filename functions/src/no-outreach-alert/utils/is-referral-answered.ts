import type { ReferralResponses } from "../types/services.js";

/**
 * A Referral is answered once any Member has sent Outreach (`outreachSentAt`)
 * or has an Offline Response, or any Legacy Membership has one. An Outreach
 * still in flight (`outreachPendingAt` alone) does not count.
 */
export function isReferralAnswered({
  memberResponses,
  legacyResponseCount,
}: ReferralResponses): boolean {
  if (legacyResponseCount > 0) {
    return true;
  }

  return memberResponses.some(
    ({ outreachSentAt, offlineResponse }) =>
      outreachSentAt !== undefined || offlineResponse !== undefined,
  );
}
