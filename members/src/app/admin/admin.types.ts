import { Timestamp } from '@angular/fire/firestore';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing'
  | 'unpaid';

export interface Member {
  createdAt: Timestamp;
  email: string;
  uid: string;
  name?: string;
  subscriptionStart?: Timestamp;
  membershipActive?: boolean;
  membershipExpiresAt?: Timestamp;
  slug?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  isAdmin?: boolean;
}

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

export interface ListMembersResponse {
  members: Member[];
  total: number;
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
