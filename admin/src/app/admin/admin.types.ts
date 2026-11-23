import type { ApiMemberResponse } from '../api-types/api-member-response';
import type { ProfileData } from '../types/profile-data';

export interface UnclaimedProfile {
  email: string;
  name: string;
  subscriptionStart: Date;
  lastPayment?: Date;
  nextPayment?: Date;
  slug?: string;
}

/**
 * List members response returned by the admin members API.
 */
export interface ListMembersResponse {
  members: ApiMemberResponse[];
  total: number;
  warning?: string;
}

export interface ListUnclaimedProfilesResponse {
  profiles: UnclaimedProfile[];
  total: number;
}

export interface UnlinkedProfile {
  slug: string;
  title: string;
  email: string;
  createdAt: string;
}

export type MemberProfile = ProfileData & {
  slug: string;
};

export interface MatchRequest {
  id: string;
  name: string;
  phone: string;
  email: string;
  zipcode: string;
  estimatedDueDate: {
    month: string;
    day: string;
    year: string;
  };
  services: string[];
  birthLocation: string;
  otherInfo: string;
  insurance: string[];
  submitted: string;
  sent: boolean;
  recaptchaScore?: number;
}

export type ReferralOutcome = 'hired' | 'not_hired' | 'not_a_fit';

/** A Member's Outreach and/or Offline Response on a Referral, with their Referral Outcome. */
export interface MemberReferralResponse {
  memberUid: string;
  /** "" when the Member can't be found. */
  memberName: string;
  outreachSentAt?: string;
  outcome?: ReferralOutcome;
  outcomeUpdatedAt?: string;
  offlineResponse?: {
    /** "" when the recorder can't be found. */
    recordedByName: string;
    recordedAt: string;
  };
}

/**
 * An Offline Response recorded for an Unclaimed Legacy Membership, with the
 * Referral Outcome a Referral Coordinator recorded for it.
 */
export interface LegacyReferralResponse {
  displayName: string;
  /** "" when the recorder can't be found. */
  recordedByName: string;
  recordedAt: string;
  outcome?: ReferralOutcome;
  outcomeUpdatedAt?: string;
}

export interface MatchRequestDetail extends MatchRequest {
  responses: {
    members: MemberReferralResponse[];
    legacy: LegacyReferralResponse[];
  };
}

export interface ListMatchRequestsResponse {
  requests: MatchRequest[];
  total: number;
  pendingCount: number;
  processedCount: number;
}

export interface Message {
  id: string;
  contactName: string;
  email: string;
  message: string;
  submitted: string;
  sent: boolean;
  recaptchaScore?: number;
}

export interface ListMessagesResponse {
  messages: Message[];
  total: number;
  pendingCount: number;
  processedCount: number;
}
