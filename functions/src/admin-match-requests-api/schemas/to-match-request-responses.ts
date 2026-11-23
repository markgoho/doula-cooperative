import type { Timestamp } from "firebase-admin/firestore";
import type { LegacyResponseDocument } from "../../collections/legacy-responses.js";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import type { MatchRequestResponses } from "./match-request-schemas.js";

function earliestActivity({
  outreachSentAt,
  offlineResponse,
}: MemberResponseDocument): number {
  const times = [outreachSentAt, offlineResponse?.recordedAt]
    .filter((time): time is Timestamp => time !== undefined)
    .map(time => time.toMillis());
  return Math.min(...times);
}

/**
 * Build the admin view of a Referral's responses from its raw documents:
 * - each Member who sent Outreach or has an Offline Response (an in-flight
 *   Outreach alone does not count), earliest activity first, with their
 *   current Referral Outcome;
 * - each Unclaimed Legacy Membership's Offline Response, earliest first, with
 *   the Referral Outcome a Referral Coordinator recorded for it.
 *
 * @param names - Member name by uid (doulas and recorders); a missing name becomes ""
 */
export function toMatchRequestResponses({
  responses,
  legacyResponses,
  names,
}: {
  responses: MemberResponseDocument[];
  legacyResponses: LegacyResponseDocument[];
  names: Map<string, string>;
}): MatchRequestResponses {
  const members = responses
    .filter(
      ({ outreachSentAt, offlineResponse }) =>
        outreachSentAt !== undefined || offlineResponse !== undefined,
    )
    .toSorted((a, b) => earliestActivity(a) - earliestActivity(b))
    .map(
      ({
        memberUid,
        outreachSentAt,
        outcome,
        outcomeUpdatedAt,
        offlineResponse,
      }) => ({
        memberUid,
        memberName: names.get(memberUid) ?? "",
        ...(outreachSentAt && {
          outreachSentAt: timestampToIso(outreachSentAt),
        }),
        ...(outcome && { outcome }),
        ...(outcome &&
          outcomeUpdatedAt && {
            outcomeUpdatedAt: timestampToIso(outcomeUpdatedAt),
          }),
        ...(offlineResponse && {
          offlineResponse: {
            recordedByName: names.get(offlineResponse.recordedBy) ?? "",
            recordedAt: timestampToIso(offlineResponse.recordedAt),
          },
        }),
      }),
    );

  const legacy = legacyResponses
    .toSorted((a, b) => a.recordedAt.toMillis() - b.recordedAt.toMillis())
    .map(
      ({ displayName, recordedBy, recordedAt, outcome, outcomeUpdatedAt }) => ({
        displayName,
        recordedByName: names.get(recordedBy) ?? "",
        recordedAt: timestampToIso(recordedAt),
        ...(outcome && { outcome }),
        ...(outcome &&
          outcomeUpdatedAt && {
            outcomeUpdatedAt: timestampToIso(outcomeUpdatedAt),
          }),
      }),
    );

  return { members, legacy };
}
