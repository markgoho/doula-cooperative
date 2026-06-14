import type { MatchRequestDocument } from "../../../collections/match-requests.js";
import type { Logger } from "../../../shared-api/types/logger.js";

export interface ReferralItem {
  id: string;
  document: MatchRequestDocument;
}

export interface ReferralsService {
  listReferrals(logger: Logger): Promise<ReferralItem[]>;
  getReferral(requestId: string, logger: Logger): Promise<ReferralItem>;
}
