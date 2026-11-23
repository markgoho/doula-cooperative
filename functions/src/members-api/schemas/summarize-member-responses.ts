import type { Timestamp } from "firebase-admin/firestore";
import type { MemberResponseDocument } from "../../collections/member-responses.js";

export interface MemberResponsesSummary {
  /** Distinct Members who sent Outreach. Offline Responses join in a later slice. */
  responseCount: number;
  /** When the viewer sent Outreach, if they did. */
  ownOutreachSentAt: Timestamp | undefined;
}

/**
 * Reduce a Referral's member response documents to what Members may see:
 * a count, plus the viewer's own Outreach. Only `outreachSentAt` counts as
 * Outreach; an in-flight send or another kind of response does not.
 */
export function summarizeMemberResponses(
  responses: MemberResponseDocument[],
  viewerUid: string,
): MemberResponsesSummary {
  const withOutreach = responses.filter(
    response => response.outreachSentAt !== undefined,
  );
  return {
    responseCount: new Set(withOutreach.map(response => response.memberUid))
      .size,
    ownOutreachSentAt: withOutreach.find(
      response => response.memberUid === viewerUid,
    )?.outreachSentAt,
  };
}
