import type { DecodedIdToken } from "firebase-admin/auth";
import type { LegacyResponseDocument } from "../../collections/legacy-responses.js";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";
import { canRecordOfflineResponses } from "../access/can-record-offline-responses.js";
import type { ReferralCoordinatorView } from "./referral-schemas.js";
import { toLegacyDoulaId } from "./to-legacy-doula-id.js";
import { toOfflineResponseRow } from "./to-offline-response-row.js";

/**
 * Build the Coordinator panel from a Referral's raw response documents:
 * - each Member who sent Outreach (an in-flight send does not count), earliest
 *   first, with their name and Referral Outcome;
 * - each Offline Response (Members and Unclaimed Legacy Memberships), earliest
 *   first, with who recorded it and whether the viewer may delete it.
 *
 * Only for Referral Coordinators and Admins; ordinary Members get
 * `summarizeMemberResponses` instead, which never names anyone. A Legacy
 * Membership's email never leaves here; its row carries an opaque id.
 *
 * @param names - Member name by uid (doulas and recorders); a missing name becomes ""
 */
export function toReferralCoordinatorView({
  responses,
  legacyResponses,
  names,
  decodedToken,
}: {
  responses: MemberResponseDocument[];
  legacyResponses: LegacyResponseDocument[];
  names: Map<string, string>;
  decodedToken: DecodedIdToken;
}): ReferralCoordinatorView {
  const memberOffline = responses.flatMap(
    ({ memberUid, offlineResponse, outcome }) =>
      offlineResponse
        ? [
            {
              kind: "member" as const,
              id: memberUid,
              displayName: names.get(memberUid) ?? "",
              ...(outcome && { outcome }),
              ...offlineResponse,
            },
          ]
        : [],
  );
  const legacyOffline = legacyResponses.map(
    ({ legacyEmail, displayName, recordedBy, recordedAt }) => ({
      kind: "legacy" as const,
      id: toLegacyDoulaId(legacyEmail),
      displayName,
      recordedBy,
      recordedAt,
    }),
  );

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
    offlineResponses: [...memberOffline, ...legacyOffline]
      .toSorted((a, b) => a.recordedAt.toMillis() - b.recordedAt.toMillis())
      .map(offline =>
        toOfflineResponseRow({ ...offline, names, decodedToken }),
      ),
    canRecordOfflineResponses: canRecordOfflineResponses(decodedToken),
  };
}
