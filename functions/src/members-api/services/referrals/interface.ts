import type { LegacyResponseDocument } from "../../../collections/legacy-responses.js";
import type { MatchRequestDocument } from "../../../collections/match-requests.js";
import type { MemberResponseDocument } from "../../../collections/member-responses.js";
import type { Logger } from "../../../shared-api/types/logger.js";

export interface ReferralItem {
  id: string;
  document: MatchRequestDocument;
}

export interface ReferralsService {
  /** Open Referrals (submitted within the last 14 days), newest first. */
  listReferrals(logger: Logger): Promise<ReferralItem[]>;
  /**
   * Every Referral regardless of age, newest first, capped at the newest 200
   * (for Referral Coordinators).
   */
  listAllReferrals(logger: Logger): Promise<ReferralItem[]>;
  getReferral(requestId: string, logger: Logger): Promise<ReferralItem>;
  /**
   * Referrals of any age that hold a response document for this Member.
   * A document does not by itself mean Outreach was sent; callers check
   * `outreachSentAt` via `listMemberResponses`.
   */
  listReferralsWithMemberResponse(
    memberUid: string,
    logger: Logger,
  ): Promise<ReferralItem[]>;
  /** Every Member's response document on one Referral. */
  listMemberResponses(
    requestId: string,
    logger: Logger,
  ): Promise<MemberResponseDocument[]>;
  /** Every Offline Response for an Unclaimed Legacy Membership on one Referral. */
  listLegacyResponses(
    requestId: string,
    logger: Logger,
  ): Promise<LegacyResponseDocument[]>;
}
