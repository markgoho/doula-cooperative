import type { MemberResponseDocument } from "../../collections/member-responses.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { ReferralCoordinatorView } from "./referral-schemas.js";

/**
 * Build the Coordinator panel from a Referral's raw member response documents:
 * each Member who sent Outreach (an in-flight send does not count), earliest
 * first, with their name and Referral Outcome.
 *
 * Only for Referral Coordinators and Admins; ordinary Members get
 * `summarizeMemberResponses` instead, which never names anyone.
 *
 * @param names - Member name by uid; a missing name becomes ""
 */
export function toReferralCoordinatorView(
  responses: MemberResponseDocument[],
  names: Map<string, string>,
): ReferralCoordinatorView {
  return {
    responses: responses
      .flatMap(response =>
        response.outreachSentAt
          ? [{ ...response, outreachSentAt: response.outreachSentAt }]
          : [],
      )
      .toSorted(
        (a, b) => a.outreachSentAt.toMillis() - b.outreachSentAt.toMillis(),
      )
      .map(({ memberUid, outreachSentAt, outcome, outcomeUpdatedAt }) => ({
        memberUid,
        memberName: names.get(memberUid) ?? "",
        outreachSentAt: timestampToIso(outreachSentAt),
        ...(outcome && { outcome }),
        ...(outcome &&
          outcomeUpdatedAt && {
            outcomeUpdatedAt: timestampToIso(outcomeUpdatedAt),
          }),
      })),
  };
}
