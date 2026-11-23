import type { ReferralOutcome } from "../../../collections/member-responses.js";
import type { Logger } from "../../../shared-api/types/logger.js";

export interface ReferralOutcomeTarget {
  requestId: string;
  memberUid: string;
}

export interface ReferralOutcomeService {
  /** Store the Member's current Referral Outcome and when it was set. No history. */
  setOutcome(
    target: ReferralOutcomeTarget & {
      outcome: ReferralOutcome;
      updatedAt: Date;
    },
    logger: Logger,
  ): Promise<void>;
  /** Remove the Member's Referral Outcome and its time. Succeeds when none is set. */
  clearOutcome(target: ReferralOutcomeTarget, logger: Logger): Promise<void>;
}
