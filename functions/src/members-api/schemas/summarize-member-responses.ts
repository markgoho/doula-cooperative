import type { Timestamp } from "firebase-admin/firestore";
import type { LegacyResponseDocument } from "../../collections/legacy-responses.js";
import type {
  MemberResponseDocument,
  OfflineResponseRecord,
  ReferralOutcome,
} from "../../collections/member-responses.js";

export interface MemberResponsesSummary {
  /**
   * Distinct doulas who responded: Members who sent Outreach or have an
   * Offline Response (each counted once), plus Unclaimed Legacy Memberships
   * with an Offline Response.
   */
  responseCount: number;
  /** When the viewer sent Outreach, if they did. */
  ownOutreachSentAt: Timestamp | undefined;
  /** The Offline Response a Referral Coordinator recorded for the viewer, if any. */
  ownOfflineResponse: OfflineResponseRecord | undefined;
  /** The viewer's own Referral Outcome, if they recorded one. */
  ownOutcome: ReferralOutcome | undefined;
  /** When the viewer's own Referral Outcome was last set. */
  ownOutcomeUpdatedAt: Timestamp | undefined;
  /**
   * Whether any doula has a hired Referral Outcome: a Member's own, or one a
   * Referral Coordinator recorded for an Unclaimed Legacy Membership. Never
   * says who.
   */
  hiredBadge: boolean;
}

/**
 * Reduce a Referral's response documents to what Members may see: a count,
 * the hired badge, plus the viewer's own Outreach, Offline Response and
 * Referral Outcome. Other doulas' names and non-hired Outcomes never leave
 * here. Only `outreachSentAt` counts as Outreach; an in-flight send does not.
 *
 * @param legacyResponses - The Referral's Offline Responses for Unclaimed
 *   Legacy Memberships; only their number and any hired Outcome are used.
 *   Omit only when the caller needs neither the count nor the hired badge.
 */
export function summarizeMemberResponses(
  responses: MemberResponseDocument[],
  viewerUid: string,
  legacyResponses: LegacyResponseDocument[] = [],
): MemberResponsesSummary {
  const responded = responses.filter(
    response =>
      response.outreachSentAt !== undefined ||
      response.offlineResponse !== undefined,
  );
  const own = responses.find(response => response.memberUid === viewerUid);
  return {
    responseCount:
      new Set(responded.map(response => response.memberUid)).size +
      legacyResponses.length,
    ownOutreachSentAt: own?.outreachSentAt,
    ownOfflineResponse: own?.offlineResponse,
    ownOutcome: own?.outcome,
    ownOutcomeUpdatedAt: own?.outcome ? own.outcomeUpdatedAt : undefined,
    hiredBadge: [...responses, ...legacyResponses].some(
      response => response.outcome === "hired",
    ),
  };
}
