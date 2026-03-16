import type { MemberDocument } from "@doula-coop/functions-shared/types/member-document.js";
import { t, type Static } from "elysia";
import type { Timestamp } from "firebase-admin/firestore";

/**
 * Subscription status enum for API responses.
 */
export const SubscriptionStatusSchema = t.Union([
  t.Literal("active"),
  t.Literal("past_due"),
  t.Literal("canceled"),
  t.Literal("incomplete"),
  t.Literal("trialing"),
  t.Literal("unpaid"),
  t.Literal("refunded"),
]);

/**
 * Welcome email status enum for API responses.
 */
export const WelcomeEmailStatusSchema = t.Union([
  t.Literal("sent"),
  t.Literal("failed"),
  t.Literal("pending"),
]);

/**
 * Member response schema - represents a member document as returned by the API.
 * All Timestamp fields are converted to ISO 8601 strings.
 * Admin-specific endpoint includes isAdmin field from custom claims.
 *
 * IMPORTANT INVARIANTS:
 * - Stripe fields (stripeCustomerId, stripeSubscriptionId, subscriptionStatus):
 *   Either all three must be present OR all three must be absent.
 *   Partial Stripe data indicates a data integrity issue.
 *
 * - Newsletter state: Only one of newsletterSubscribedAt OR newsletterUnsubscribedAt
 *   should be set, never both. newsletterSubscribed boolean indicates current state.
 *
 * - Membership expiration: membershipExpiresAt should only be present when
 *   subscriptionStart exists (either from Stripe or manual membership).
 */
export const MemberResponseSchema = t.Object({
  uid: t.String({
    description: "User ID (Firestore document ID)",
  }),
  email: t.String({
    format: "email",
    description: "User email address",
  }),
  createdAt: t.String({
    format: "date-time",
    description: "Account creation timestamp (ISO 8601)",
  }),
  isAdmin: t.Boolean({
    description: "Whether the user has admin privileges (from custom claims)",
  }),
  name: t.Optional(
    t.String({
      description: "User display name",
    }),
  ),
  subscriptionStart: t.Optional(
    t.String({
      format: "date-time",
      description: "Subscription start date (ISO 8601)",
    }),
  ),
  membershipActive: t.Optional(
    t.Boolean({
      description: "Whether the membership is currently active",
    }),
  ),
  membershipExpiresAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Membership expiration date (ISO 8601)",
    }),
  ),
  slug: t.Optional(
    t.String({
      description: "URL-friendly slug for the member's profile",
    }),
  ),
  profileCreatedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Profile creation timestamp (ISO 8601)",
    }),
  ),
  stripeCustomerId: t.Optional(
    t.String({
      description: "Stripe customer ID",
    }),
  ),
  stripeSubscriptionId: t.Optional(
    t.String({
      description: "Stripe subscription ID",
    }),
  ),
  subscriptionStatus: t.Optional(SubscriptionStatusSchema),
  welcomeEmailStatus: t.Optional(WelcomeEmailStatusSchema),
  welcomeEmailSentAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Welcome email sent timestamp (ISO 8601)",
    }),
  ),
  welcomeEmailError: t.Optional(
    t.String({
      description: "Error message if welcome email failed",
    }),
  ),
  newsletterSubscribed: t.Optional(
    t.Boolean({
      description: "Whether the user is subscribed to the newsletter",
    }),
  ),
  newsletterSubscribedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Newsletter subscription timestamp (ISO 8601)",
    }),
  ),
  newsletterUnsubscribedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Newsletter unsubscription timestamp (ISO 8601)",
    }),
  ),
  refundedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "Refund timestamp (ISO 8601)",
    }),
  ),
  refundReason: t.Optional(
    t.String({
      description: "Reason for the refund",
    }),
  ),
});

/**
 * Inferred TypeScript type for member API responses.
 */
export type MemberResponse = Static<typeof MemberResponseSchema>;

/**
 * Convert a Timestamp to an ISO 8601 string.
 */
function timestampToIso(timestamp: Timestamp): string {
  return timestamp.toDate().toISOString();
}

/**
 * Convert a Firestore MemberDocument to an API MemberResponse.
 * Transforms all Timestamp objects to ISO 8601 strings.
 *
 * @param document - The member document from Firestore
 * @param isAdmin - Whether the user has admin custom claim (checked via Firebase Auth)
 */
export function toMemberResponse(
  document: MemberDocument,
  isAdmin: boolean,
): MemberResponse {
  return {
    uid: document.uid,
    email: document.email,
    createdAt: timestampToIso(document.createdAt),
    isAdmin,
    ...(document.name !== undefined && { name: document.name }),
    ...(document.subscriptionStart !== undefined && {
      subscriptionStart: timestampToIso(document.subscriptionStart),
    }),
    ...(document.membershipActive !== undefined && {
      membershipActive: document.membershipActive,
    }),
    ...(document.membershipExpiresAt !== undefined && {
      membershipExpiresAt: timestampToIso(document.membershipExpiresAt),
    }),
    ...(document.slug !== undefined && { slug: document.slug }),
    ...(document.profileCreatedAt !== undefined && {
      profileCreatedAt: timestampToIso(document.profileCreatedAt),
    }),
    ...(document.stripeCustomerId !== undefined && {
      stripeCustomerId: document.stripeCustomerId,
    }),
    ...(document.stripeSubscriptionId !== undefined && {
      stripeSubscriptionId: document.stripeSubscriptionId,
    }),
    ...(document.subscriptionStatus !== undefined && {
      subscriptionStatus: document.subscriptionStatus,
    }),
    ...(document.welcomeEmailStatus !== undefined && {
      welcomeEmailStatus: document.welcomeEmailStatus,
    }),
    ...(document.welcomeEmailSentAt !== undefined && {
      welcomeEmailSentAt: timestampToIso(document.welcomeEmailSentAt),
    }),
    ...(document.welcomeEmailError !== undefined && {
      welcomeEmailError: document.welcomeEmailError,
    }),
    ...(document.newsletterSubscribed !== undefined && {
      newsletterSubscribed: document.newsletterSubscribed,
    }),
    ...(document.newsletterSubscribedAt !== undefined && {
      newsletterSubscribedAt: timestampToIso(document.newsletterSubscribedAt),
    }),
    ...(document.newsletterUnsubscribedAt !== undefined && {
      newsletterUnsubscribedAt: timestampToIso(
        document.newsletterUnsubscribedAt,
      ),
    }),
    ...(document.refundedAt !== undefined && {
      refundedAt: timestampToIso(document.refundedAt),
    }),
    ...(document.refundReason !== undefined && {
      refundReason: document.refundReason,
    }),
  };
}

/**
 * List members response schema for the GET /api/admin/members endpoint.
 * Returns an array of members with pagination metadata.
 */
export const ListMembersResponseSchema = t.Object({
  members: t.Array(MemberResponseSchema),
  total: t.Number({
    description: "Total number of members matching the query",
  }),
  warning: t.Optional(
    t.String({
      description:
        "Warning message if some members were excluded due to invalid data",
    }),
  ),
});

export type ListMembersResponse = Static<typeof ListMembersResponseSchema>;

/**
 * Generic success response with member data.
 */
export const MemberSuccessResponseSchema = t.Object({
  success: t.Literal(true),
  member: MemberResponseSchema,
});

export type MemberSuccessResponse = Static<typeof MemberSuccessResponseSchema>;

/**
 * Reusable schema for memberId path parameter.
 */
export const MemberIdParameterSchema = t.Object({
  memberId: t.String({
    minLength: 1,
    maxLength: 128,
    description: "The Firestore document ID of the member",
    error: "Member ID must be a non-empty string (max 128 characters)",
  }),
});

/**
 * Query parameters for listing members with pagination.
 */
export const PaginationQuerySchema = t.Object({
  limit: t.Optional(
    t.Number({
      minimum: 1,
      maximum: 100,
      description: "Maximum number of members to return",
      error: "Limit must be between 1 and 100",
    }),
  ),
  offset: t.Optional(
    t.Number({
      minimum: 0,
      description: "Number of members to skip",
      error: "Offset must be 0 or greater",
    }),
  ),
});

/**
 * Request body schema for updating member fields.
 */
export const UpdateMemberBodySchema = t.Object({
  name: t.Optional(t.String({ minLength: 1 })),
  email: t.Optional(t.String({ format: "email" })),
  subscriptionStart: t.Optional(t.String({ format: "date-time" })),
  membershipExpiresAt: t.Optional(t.String({ format: "date-time" })),
  membershipActive: t.Optional(t.Boolean()),
  slug: t.Optional(t.String({ minLength: 1 })),
});

export type UpdateMemberBody = Static<typeof UpdateMemberBodySchema>;

/**
 * Request body schema for activating membership.
 */
export const ActivateMembershipBodySchema = t.Optional(
  t.Object({
    subscriptionStart: t.Optional(t.String({ format: "date-time" })),
    membershipExpiresAt: t.Optional(t.String({ format: "date-time" })),
  }),
);

/**
 * Request body schema for extending membership.
 */
export const ExtendMembershipBodySchema = t.Object({
  newExpirationDate: t.String({
    format: "date-time",
    description: "New membership expiration date (ISO 8601)",
    error: "newExpirationDate must be a valid ISO 8601 date-time",
  }),
});

/**
 * Request body schema for updating custom claims.
 * Set to true to grant, false/omit to revoke.
 */
export const UpdateClaimsBodySchema = t.Object({
  admin: t.Optional(
    t.Boolean({
      description: "Set to true to grant admin privileges, false to revoke",
    }),
  ),
});

export type UpdateClaimsBody = Static<typeof UpdateClaimsBodySchema>;

/**
 * Success response for updating custom claims.
 */
export const UpdateClaimsResponseSchema = t.Object({
  success: t.Literal(true),
  uid: t.String({
    description: "UID of the user whose claims were updated",
  }),
});

export type UpdateClaimsResponse = Static<typeof UpdateClaimsResponseSchema>;

/**
 * Error response schema - reusable for all error cases.
 */
const ErrorResponseSchema = t.Object({
  error: t.String(),
});

/**
 * GET /api/admin/members response - union of success and error.
 */
export const ListMembersApiResponseSchema = t.Union([
  ListMembersResponseSchema,
  ErrorResponseSchema,
]);

export type ListMembersApiResponse = Static<
  typeof ListMembersApiResponseSchema
>;

/**
 * GET /api/admin/members/:memberId response - union of success and error.
 */
export const GetMemberApiResponseSchema = t.Union([
  MemberResponseSchema,
  ErrorResponseSchema,
]);

export type GetMemberApiResponse = Static<typeof GetMemberApiResponseSchema>;

/**
 * PATCH /api/admin/members/:memberId response - union of success and error.
 */
export const UpdateMemberApiResponseSchema = t.Union([
  MemberSuccessResponseSchema,
  ErrorResponseSchema,
]);

export type UpdateMemberApiResponse = Static<
  typeof UpdateMemberApiResponseSchema
>;

/**
 * POST /api/admin/members/:memberId/membership/activate response - union of success and error.
 */
export const ActivateMembershipApiResponseSchema = t.Union([
  MemberSuccessResponseSchema,
  ErrorResponseSchema,
]);

export type ActivateMembershipApiResponse = Static<
  typeof ActivateMembershipApiResponseSchema
>;

/**
 * POST /api/admin/members/:memberId/membership/cancel response - union of success and error.
 */
export const CancelMembershipApiResponseSchema = t.Union([
  MemberSuccessResponseSchema,
  ErrorResponseSchema,
]);

export type CancelMembershipApiResponse = Static<
  typeof CancelMembershipApiResponseSchema
>;

/**
 * POST /api/admin/members/:memberId/membership/extend response - union of success and error.
 */
export const ExtendMembershipApiResponseSchema = t.Union([
  MemberSuccessResponseSchema,
  ErrorResponseSchema,
]);

export type ExtendMembershipApiResponse = Static<
  typeof ExtendMembershipApiResponseSchema
>;

/**
 * PATCH /api/admin/members/:memberId/claims response - union of success and error.
 */
export const UpdateClaimsApiResponseSchema = t.Union([
  UpdateClaimsResponseSchema,
  ErrorResponseSchema,
]);

export type UpdateClaimsApiResponse = Static<
  typeof UpdateClaimsApiResponseSchema
>;

/**
 * Request body schema for refunding membership.
 */
export const RefundMembershipBodySchema = t.Optional(
  t.Object({
    reason: t.Optional(
      t.String({
        description: "Reason for the refund",
      }),
    ),
  }),
);

/**
 * Refund result details schema.
 */
export const RefundResultSchema = t.Object({
  stripeRefundCreated: t.Boolean({
    description: "Whether the Stripe refund was created",
  }),
  subscriptionCanceled: t.Boolean({
    description: "Whether the Stripe subscription was canceled",
  }),
  memberDeactivated: t.Boolean({
    description: "Whether the member was deactivated in Firestore",
  }),
  profileDrafted: t.Optional(
    t.Boolean({
      description: "Whether the Hugo profile was set to draft",
    }),
  ),
  newsletterUnsubscribed: t.Optional(
    t.Boolean({
      description: "Whether the member was unsubscribed from newsletter",
    }),
  ),
  memberNotified: t.Optional(
    t.Boolean({
      description: "Whether the member was sent a refund notification email",
    }),
  ),
  warning: t.Optional(
    t.String({
      description: "Warning message for non-critical failures",
    }),
  ),
});

/**
 * Success response for refund membership.
 */
export const RefundMembershipResponseSchema = t.Object({
  success: t.Literal(true),
  member: MemberResponseSchema,
  refundResult: RefundResultSchema,
});

export type RefundMembershipResponse = Static<
  typeof RefundMembershipResponseSchema
>;

/**
 * POST /api/admin/members/:memberId/membership/refund response - union of success and error.
 */
export const RefundMembershipApiResponseSchema = t.Union([
  RefundMembershipResponseSchema,
  ErrorResponseSchema,
]);

export type RefundMembershipApiResponse = Static<
  typeof RefundMembershipApiResponseSchema
>;

/**
 * Clean slate delete result schema.
 */
export const CleanSlateResultSchema = t.Object({
  success: t.Literal(true),
  deletedUid: t.String({
    description: "UID of the deleted user",
  }),
  subscriptionCanceled: t.Optional(
    t.Boolean({
      description: "Whether the Stripe subscription was canceled",
    }),
  ),
  stripeCustomerDeleted: t.Optional(
    t.Boolean({
      description: "Whether the Stripe customer was deleted",
    }),
  ),
  newsletterUnsubscribed: t.Optional(
    t.Boolean({
      description: "Whether the member was unsubscribed from newsletter",
    }),
  ),
  profileDeleted: t.Optional(
    t.Boolean({
      description: "Whether the profile document was deleted from Firestore",
    }),
  ),
  profileImageDeleted: t.Optional(
    t.Boolean({
      description: "Whether the profile image was deleted from ImageKit",
    }),
  ),
  memberDocumentDeleted: t.Boolean({
    description: "Whether the Firestore member document was deleted",
  }),
  authUserDeleted: t.Boolean({
    description: "Whether the Firebase Auth user was deleted",
  }),
  warning: t.Optional(
    t.String({
      description: "Warning message for non-critical failures",
    }),
  ),
});

export type CleanSlateResultResponse = Static<typeof CleanSlateResultSchema>;

/**
 * POST /api/admin/members/:memberId/clean-slate response - union of success and error.
 */
export const CleanSlateApiResponseSchema = t.Union([
  CleanSlateResultSchema,
  ErrorResponseSchema,
]);

export type CleanSlateApiResponse = Static<typeof CleanSlateApiResponseSchema>;

/**
 * Success response for toggling profile draft status.
 */
export const ToggleProfileDraftResponseSchema = t.Object({
  success: t.Literal(true),
  slug: t.String({
    description: "The profile slug that was toggled",
  }),
  draft: t.Boolean({
    description: "The new draft status of the profile",
  }),
  warning: t.Optional(
    t.String({
      description: "Warning message if Hugo rebuild failed",
    }),
  ),
});

export type ToggleProfileDraftResponse = Static<
  typeof ToggleProfileDraftResponseSchema
>;

/**
 * POST /api/admin/members/:memberId/profile/toggle-draft response - union of success and error.
 */
export const ToggleProfileDraftApiResponseSchema = t.Union([
  ToggleProfileDraftResponseSchema,
  ErrorResponseSchema,
]);

export type ToggleProfileDraftApiResponse = Static<
  typeof ToggleProfileDraftApiResponseSchema
>;

/**
 * Profile content schema for admin read profile response.
 * Includes all ProfileData fields plus metadata.
 */
export const ProfileContentSchema = t.Object({
  title: t.String(),
  bio: t.String(),
  credentials: t.Optional(t.String()),
  pronouns: t.Optional(t.String()),
  tags: t.Optional(t.Array(t.String())),
  contact: t.Optional(
    t.Object({
      phone: t.Optional(t.String()),
      email: t.Optional(t.String()),
      website: t.Optional(t.String()),
      business_name: t.Optional(t.String()),
    }),
  ),
  draft: t.Optional(t.Boolean()),
  image: t.Optional(t.String()),
  createdAt: t.String({
    description: "ISO 8601 timestamp when the profile was first created",
  }),
  updatedAt: t.String({
    description: "ISO 8601 timestamp when the profile was last updated",
  }),
  ownerUid: t.Optional(
    t.String({
      description: "Firebase Auth UID of the profile owner",
    }),
  ),
});

/**
 * Success response for reading a member's profile.
 */
export const ReadProfileResponseSchema = t.Object({
  success: t.Literal(true),
  slug: t.String({
    description: "The profile slug",
  }),
  profile: ProfileContentSchema,
});

export type ReadProfileResponse = Static<typeof ReadProfileResponseSchema>;

/**
 * GET /api/admin/members/:memberId/profile response - union of success and error.
 */
export const ReadProfileApiResponseSchema = t.Union([
  ReadProfileResponseSchema,
  ErrorResponseSchema,
]);

export type ReadProfileApiResponse = Static<
  typeof ReadProfileApiResponseSchema
>;

/**
 * Schema for an unlinked profile in list responses.
 */
export const UnlinkedProfileSchema = t.Object({
  slug: t.String({
    description: "URL-friendly slug identifying the profile",
  }),
  title: t.String({
    description: "Profile display name/title",
  }),
  email: t.String({
    description: "Contact email from the profile",
  }),
  createdAt: t.String({
    description: "Profile creation timestamp (ISO 8601)",
  }),
});

/**
 * GET /api/admin/members/unlinked-profiles response - success case.
 */
export const ListUnlinkedProfilesResponseSchema = t.Object({
  profiles: t.Array(UnlinkedProfileSchema),
});

export type ListUnlinkedProfilesResponse = Static<
  typeof ListUnlinkedProfilesResponseSchema
>;

/**
 * GET /api/admin/members/unlinked-profiles response - union of success and error.
 */
export const ListUnlinkedProfilesApiResponseSchema = t.Union([
  ListUnlinkedProfilesResponseSchema,
  ErrorResponseSchema,
]);

export type ListUnlinkedProfilesApiResponse = Static<
  typeof ListUnlinkedProfilesApiResponseSchema
>;

/**
 * Request body schema for linking a profile to a member.
 */
export const LinkProfileBodySchema = t.Object({
  slug: t.String({
    minLength: 1,
    description: "The profile slug to link to this member",
    error: "Slug must be a non-empty string",
  }),
});

export type LinkProfileBody = Static<typeof LinkProfileBodySchema>;

/**
 * POST /api/admin/members/:memberId/link-profile response - union of success and error.
 */
export const LinkProfileApiResponseSchema = t.Union([
  MemberSuccessResponseSchema,
  ErrorResponseSchema,
]);

export type LinkProfileApiResponse = Static<
  typeof LinkProfileApiResponseSchema
>;
