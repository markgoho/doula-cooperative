import {
  MemberResponseSchema,
  type ApiMemberResponse,
} from "@doula-coop/shared";
import { t, type Static } from "elysia";

export type MemberResponse = ApiMemberResponse;

import type { Timestamp } from "firebase-admin/firestore";
import type { MemberDocument } from "../../types/member-document.js";

/**
 * Inferred TypeScript type for member API responses.
 */

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
    ...(document.lastPayment !== undefined && {
      lastPayment: timestampToIso(document.lastPayment),
    }),
    ...(document.nextPayment !== undefined && {
      nextPayment: timestampToIso(document.nextPayment),
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
 * List members response schema with pagination metadata.
 */
export const ListMembersResponseSchema = t.Object({
  members: t.Array(MemberResponseSchema),
  total: t.Number({
    description: "Total number of members",
  }),
  pagination: t.Object({
    limit: t.Number({
      description: "Number of items per page",
    }),
    offset: t.Number({
      description: "Number of items skipped",
    }),
    hasNext: t.Boolean({
      description: "Whether there are more items available",
    }),
  }),
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
 * Request body schema for updating newsletter preference.
 */
export const UpdateNewsletterPreferenceBodySchema = t.Object({
  subscribed: t.Boolean({
    description: "Whether to subscribe to the newsletter",
  }),
});

export type UpdateNewsletterPreferenceBody = Static<
  typeof UpdateNewsletterPreferenceBodySchema
>;

/**
 * Error response schema.
 */
export const ErrorResponseSchema = t.Object({
  error: t.String({
    description: "Error message describing what went wrong",
  }),
});

export type ErrorResponse = Static<typeof ErrorResponseSchema>;

/**
 * GET /members/:memberId response schema (union of success and error).
 */
export const GetMemberResponseSchema = t.Union([
  MemberResponseSchema,
  ErrorResponseSchema,
]);

export type GetMemberResponse = Static<typeof GetMemberResponseSchema>;

/**
 * Newsletter preference update success response.
 */
export const UpdateNewsletterPreferenceSuccessSchema = t.Object({
  success: t.Literal(true),
  subscribed: t.Boolean({
    description: "Current subscription status after update",
  }),
});

export type UpdateNewsletterPreferenceSuccessResponse = Static<
  typeof UpdateNewsletterPreferenceSuccessSchema
>;

/**
 * PATCH /members/:memberId/newsletter-preference response schema (union of success and error).
 */
export const UpdateNewsletterPreferenceResponseSchema = t.Union([
  UpdateNewsletterPreferenceSuccessSchema,
  ErrorResponseSchema,
]);

export type UpdateNewsletterPreferenceResponse = Static<
  typeof UpdateNewsletterPreferenceResponseSchema
>;

/**
 * Verify email success response.
 */
export const VerifyEmailSuccessSchema = t.Object({
  success: t.Literal(true),
});

/**
 * POST /members/:memberId/verify-email response schema (union of success and error).
 */
export const VerifyEmailResponseSchema = t.Union([
  VerifyEmailSuccessSchema,
  ErrorResponseSchema,
]);

export type VerifyEmailResponse = Static<typeof VerifyEmailResponseSchema>;

/**
 * Request body schema for updating member name.
 */
export const UpdateMemberNameBodySchema = t.Object({
  name: t.String({
    minLength: 1,
    maxLength: 200,
    description: "The member's full name",
    error: "Name must be between 1 and 200 characters",
  }),
});

export type UpdateMemberNameBody = Static<typeof UpdateMemberNameBodySchema>;

/**
 * Member name update success response.
 */
export const UpdateMemberNameSuccessSchema = t.Object({
  success: t.Literal(true),
  member: MemberResponseSchema,
});

export type UpdateMemberNameSuccessResponse = Static<
  typeof UpdateMemberNameSuccessSchema
>;

/**
 * PATCH /members/:memberId/name response schema (union of success and error).
 */
export const UpdateMemberNameResponseSchema = t.Union([
  UpdateMemberNameSuccessSchema,
  ErrorResponseSchema,
]);

export type UpdateMemberNameResponse = Static<
  typeof UpdateMemberNameResponseSchema
>;

/**
 * Cancel membership success response.
 */
export const CancelMembershipSuccessSchema = t.Object({
  success: t.Literal(true),
  member: MemberResponseSchema,
});

export type CancelMembershipSuccessResponse = Static<
  typeof CancelMembershipSuccessSchema
>;

/**
 * POST /members/:memberId/membership/cancel response schema (union of success and error).
 */
export const CancelMembershipResponseSchema = t.Union([
  CancelMembershipSuccessSchema,
  ErrorResponseSchema,
]);

export type CancelMembershipResponse = Static<
  typeof CancelMembershipResponseSchema
>;
