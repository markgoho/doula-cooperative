import { t, type Static } from "elysia";
import type { Timestamp } from "firebase-admin/firestore";
import type { MemberDocument } from "../../types/member-document.js";

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
  const response: MemberResponse = {
    uid: document.uid,
    email: document.email,
    createdAt: timestampToIso(document.createdAt),
    isAdmin,
  };

  // Add optional fields if they exist
  if (document.name !== undefined) {
    response.name = document.name;
  }
  if (document.subscriptionStart !== undefined) {
    response.subscriptionStart = timestampToIso(document.subscriptionStart);
  }
  if (document.membershipActive !== undefined) {
    response.membershipActive = document.membershipActive;
  }
  if (document.membershipExpiresAt !== undefined) {
    response.membershipExpiresAt = timestampToIso(document.membershipExpiresAt);
  }
  if (document.slug !== undefined) {
    response.slug = document.slug;
  }
  if (document.profileCreatedAt !== undefined) {
    response.profileCreatedAt = timestampToIso(document.profileCreatedAt);
  }
  if (document.stripeCustomerId !== undefined) {
    response.stripeCustomerId = document.stripeCustomerId;
  }
  if (document.stripeSubscriptionId !== undefined) {
    response.stripeSubscriptionId = document.stripeSubscriptionId;
  }
  if (document.subscriptionStatus !== undefined) {
    response.subscriptionStatus = document.subscriptionStatus;
  }
  if (document.welcomeEmailStatus !== undefined) {
    response.welcomeEmailStatus = document.welcomeEmailStatus;
  }
  if (document.welcomeEmailSentAt !== undefined) {
    response.welcomeEmailSentAt = timestampToIso(document.welcomeEmailSentAt);
  }
  if (document.welcomeEmailError !== undefined) {
    response.welcomeEmailError = document.welcomeEmailError;
  }
  if (document.newsletterSubscribed !== undefined) {
    response.newsletterSubscribed = document.newsletterSubscribed;
  }
  if (document.newsletterSubscribedAt !== undefined) {
    response.newsletterSubscribedAt = timestampToIso(document.newsletterSubscribedAt);
  }
  if (document.newsletterUnsubscribedAt !== undefined) {
    response.newsletterUnsubscribedAt = timestampToIso(
      document.newsletterUnsubscribedAt,
    );
  }

  return response;
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
 * Delete user success response.
 */
export const DeleteUserResponseSchema = t.Object({
  success: t.Literal(true),
  deletedUid: t.String({
    description: "UID of the deleted user",
  }),
});

export type DeleteUserResponse = Static<typeof DeleteUserResponseSchema>;

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
 * DELETE /api/admin/members/:memberId response - union of success and error.
 */
export const DeleteUserApiResponseSchema = t.Union([
  DeleteUserResponseSchema,
  ErrorResponseSchema,
]);

export type DeleteUserApiResponse = Static<typeof DeleteUserApiResponseSchema>;

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
 * POST /api/admin/members/:memberId/membership/deactivate response - union of success and error.
 */
export const DeactivateMembershipApiResponseSchema = t.Union([
  MemberSuccessResponseSchema,
  ErrorResponseSchema,
]);

export type DeactivateMembershipApiResponse = Static<
  typeof DeactivateMembershipApiResponseSchema
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
