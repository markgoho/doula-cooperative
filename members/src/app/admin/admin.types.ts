import { Timestamp } from '@angular/fire/firestore';
import type { ApiMemberResponse } from '../api-types/members-api.types';

// Re-export types from API types for convenience

/**
 * Member domain model for the Angular admin application.
 * Alias for the API response type.
 */
export type Member = ApiMemberResponse;

export interface UnclaimedProfile {
  email: string;
  name: string;
  subscriptionStart: Timestamp;
  lastPayment?: Timestamp;
  nextPayment?: Timestamp;
  slug?: string;
  invitationEmailStatus?: 'sent' | 'failed' | 'pending';
  invitationEmailSentAt?: Timestamp;
  invitationEmailError?: string;
}

/**
 * List members response - matches API but uses frontend Member type.
 */
export interface ListMembersResponse {
  members: Member[];
  total: number;
  warning?: string;
}

export interface ListUnclaimedProfilesResponse {
  profiles: UnclaimedProfile[];
  total: number;
}

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
