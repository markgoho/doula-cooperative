import type { SubscriptionStatus } from '../api-types/subscription-status';

export interface Member {
  createdAt: Date;
  email: string;
  uid: string;
  isAdmin: boolean;
  name?: string;
  subscriptionStart?: Date;
  membershipActive?: boolean;
  membershipExpiresAt?: Date;
  slug?: string;
  profileCreatedAt?: Date;
  profileApprovedAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  lastPayment?: Date;
  nextPayment?: Date;
  newsletterSubscribed?: boolean;
  newsletterSubscribedAt?: Date;
  newsletterUnsubscribedAt?: Date;
}
