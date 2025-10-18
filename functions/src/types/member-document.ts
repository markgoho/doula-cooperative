import { Timestamp } from "firebase-admin/firestore";

export type SubscriptionStatus = "active" | "past_due" | "canceled" | "incomplete";

export interface MemberDocument {
  createdAt: Timestamp;
  email: string;
  uid: string;
  name?: string;
  subscriptionStart?: Timestamp;
  membershipActive?: boolean;
  membershipExpiresAt?: Timestamp;
  slug?: string;
  hasProfile?: boolean;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
}
