/**
 * API response types for members-api and admin-members-api Elysia endpoints.
 * All timestamp fields are ISO 8601 strings.
 *
 * This is the source of truth for Member API response structure across the frontend.
 * Used by:
 * - MembershipService (for converting API responses to frontend Member objects)
 * - Admin member management components
 * - E2E tests for properly typed mock data
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
 * Member response from GET /api/members/:memberId or GET /api/admin/members/:memberId
 * All timestamp fields are ISO 8601 strings.
 * Admin endpoints include isAdmin field from Firebase Auth custom claims.
 */
export interface ApiMemberResponse {
  uid: string;
  email: string;
  createdAt: string; // ISO 8601
  isAdmin: boolean; // Whether the user has admin privileges (from custom claims)
  name?: string;
  subscriptionStart?: string; // ISO 8601
  membershipActive?: boolean;
  membershipExpiresAt?: string; // ISO 8601
  slug?: string;
  profileCreatedAt?: string; // ISO 8601
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  lastPayment?: string; // ISO 8601
  nextPayment?: string; // ISO 8601
  welcomeEmailStatus?: WelcomeEmailStatus;
  welcomeEmailSentAt?: string; // ISO 8601
  welcomeEmailError?: string;
  newsletterSubscribed?: boolean;
  newsletterSubscribedAt?: string; // ISO 8601
  newsletterUnsubscribedAt?: string; // ISO 8601
}

/**
 * List members response from GET /api/admin/members
 */
export interface ApiListMembersResponse {
  members: ApiMemberResponse[];
  total: number;
  warning?: string;
}

/**
 * Unclaimed profile response from GET /api/admin/unclaimed-profiles
 * Represents pre-imported profiles from legacy system stored in migrated_users_import collection.
 * All timestamp fields are ISO 8601 strings.
 */
export interface ApiUnclaimedProfileResponse {
  email: string;
  name: string;
  subscriptionStart: string; // ISO 8601
  lastPayment?: string; // ISO 8601
  nextPayment?: string; // ISO 8601
  slug?: string;
  invitationEmailStatus?: 'sent' | 'failed' | 'pending';
  invitationEmailSentAt?: string; // ISO 8601
  invitationEmailError?: string;
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}
