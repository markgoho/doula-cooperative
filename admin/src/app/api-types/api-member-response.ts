import type { SubscriptionStatus } from './subscription-status';
import type { WelcomeEmailStatus } from './welcome-email-status';

export interface ApiMemberResponse {
  uid: string;
  email: string;
  createdAt: string;
  isAdmin: boolean;
  /** Only returned by the member detail endpoint (GET /api/admin/members/:uid) */
  isReferralCoordinator?: boolean;
  name?: string;
  subscriptionStart?: string;
  membershipActive?: boolean;
  membershipExpiresAt?: string;
  slug?: string;
  profileCreatedAt?: string;
  profileApprovedAt?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  lastPayment?: string;
  nextPayment?: string;
  welcomeEmailStatus?: WelcomeEmailStatus;
  welcomeEmailSentAt?: string;
  welcomeEmailError?: string;
  newsletterSubscribed?: boolean;
  newsletterSubscribedAt?: string;
  newsletterUnsubscribedAt?: string;
  refundedAt?: string;
  refundReason?: string;
}

// export type Member = ApiMemberResponse;
