/**
 * API response types for the admin-members-api Elysia endpoints.
 * All timestamp fields are ISO 8601 strings.
 */

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing'
  | 'unpaid';

export type WelcomeEmailStatus = 'sent' | 'failed' | 'pending';

/**
 * Member response from the API with ISO 8601 timestamp strings.
 */
export interface ApiMemberResponse {
  uid: string;
  email: string;
  createdAt: string; // ISO 8601
  name?: string;
  subscriptionStart?: string; // ISO 8601
  membershipActive?: boolean;
  membershipExpiresAt?: string; // ISO 8601
  slug?: string;
  profileCreatedAt?: string; // ISO 8601
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  welcomeEmailStatus?: WelcomeEmailStatus;
  welcomeEmailSentAt?: string; // ISO 8601
  welcomeEmailError?: string;
  newsletterSubscribed?: boolean;
  newsletterSubscribedAt?: string; // ISO 8601
  newsletterUnsubscribedAt?: string; // ISO 8601
}

/**
 * List members response from the API.
 */
export interface ApiListMembersResponse {
  members: ApiMemberResponse[];
  total: number;
  warning?: string;
}
