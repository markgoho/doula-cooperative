import type { MatchRequestDocument } from "../../collections/match-requests.js";
import type { MemberResponseDocument } from "../../collections/member-responses.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";

/** A Match Request with its document ID. */
export interface NotifiedMatchRequest {
  id: string;
  matchRequest: MatchRequestDocument;
}

/** Every response recorded on one Referral. */
export interface ReferralResponses {
  memberResponses: MemberResponseDocument[];
  legacyResponseCount: number;
}

/**
 * Firestore access for the No-Outreach Alert sweep.
 * Firestore only; the answered/unanswered rule lives in the handler.
 */
export interface NoOutreachAlertStore {
  /** Match Requests whose `memberNotificationSentAt` is within [from, to]. */
  listMatchRequestsNotifiedBetween(range: {
    from: Date;
    to: Date;
  }): Promise<NotifiedMatchRequest[]>;

  /** The `memberResponses` documents and the `legacyResponses` count. */
  listReferralResponses(matchRequestId: string): Promise<ReferralResponses>;

  /** Set `noOutreachAlertSentAt` to a server timestamp. */
  markNoOutreachAlertSent(matchRequestId: string): Promise<void>;
}

export interface NoOutreachAlertServices {
  emailService: EmailServiceInterface;
  referralPortalSettingsService: Pick<
    ReferralPortalSettingsService,
    "getReferralPortalSettings"
  >;
  noOutreachAlertStore: NoOutreachAlertStore;
  logger: Logger;
}
