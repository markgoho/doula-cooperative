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
