import type { Timestamp } from "firebase-admin/firestore";
import type {
  MemberResponseDocument,
  ReferralOutcome,
} from "../../collections/member-responses.js";

export interface MemberResponsesSummary {
  /** Distinct Members who sent Outreach. Offline Responses join in a later slice. */
  responseCount: number;
  /** When the viewer sent Outreach, if they did. */
  ownOutreachSentAt: Timestamp | undefined;
  /** The viewer's own Referral Outcome, if they recorded one. */
  ownOutcome: ReferralOutcome | undefined;
  /** When the viewer's own Referral Outcome was last set. */
  ownOutcomeUpdatedAt: Timestamp | undefined;
  /** Whether any Member recorded a hired Referral Outcome. Never says who. */
  hiredBadge: boolean;
}

/**
 * Reduce a Referral's member response documents to what Members may see:
 * a count, the hired badge, plus the viewer's own Outreach and Referral
 * Outcome. Other Members' names and non-hired Outcomes never leave here.
 * Only `outreachSentAt` counts as Outreach; an in-flight send or another kind
 * of response does not.
 */
export function summarizeMemberResponses(
  responses: MemberResponseDocument[],
  viewerUid: string,
): MemberResponsesSummary {
  const withOutreach = responses.filter(
    response => response.outreachSentAt !== undefined,
  );
  const own = responses.find(response => response.memberUid === viewerUid);
  return {
    responseCount: new Set(withOutreach.map(response => response.memberUid))
      .size,
    ownOutreachSentAt: own?.outreachSentAt,
    ownOutcome: own?.outcome,
    ownOutcomeUpdatedAt: own?.outcome ? own.outcomeUpdatedAt : undefined,
    hiredBadge: responses.some(response => response.outcome === "hired"),
  };
}
