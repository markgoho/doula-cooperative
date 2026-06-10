import type { MatchRequestDocument } from "../../../collections/match-requests.js";

export interface ReferralItem {
  id: string;
  document: MatchRequestDocument;
}

export interface ReferralsService {
  listReferrals(): Promise<ReferralItem[]>;
  getReferral(requestId: string): Promise<ReferralItem>;
}
