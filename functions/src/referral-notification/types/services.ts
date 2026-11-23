import type { MatchRequestDocument } from "../../collections/match-requests.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { MemberDocument } from "../../types/member-document.js";

/**
 * Firestore access for the Referral Notification trigger.
 * Firestore only; recipient rules live in the handler.
 */
export interface ReferralNotificationStore {
  /** Fresh read of the Match Request (the event snapshot never carries the marker). */
  getMatchRequest(
    matchRequestId: string,
  ): Promise<MatchRequestDocument | undefined>;

  /** Members whose stored subscriptionStatus is "active" or "trialing". */
  listMembersWithLiveSubscription(): Promise<MemberDocument[]>;

  /** Set `memberNotificationSentAt` to a server timestamp. */
  markMemberNotificationSent(matchRequestId: string): Promise<void>;
}

export interface ReferralNotificationServices {
  emailService: EmailServiceInterface;
  referralPortalSettingsService: Pick<
    ReferralPortalSettingsService,
    "getReferralPortalSettings"
  >;
  referralNotificationStore: ReferralNotificationStore;
  logger: Logger;
}
