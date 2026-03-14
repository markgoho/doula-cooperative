import { t, type Static } from "elysia";
import type { UnclaimedProfileDocument } from "../../collections/migrated-users-import.js";

const UnclaimedProfileSuccessSchema = t.Object({
  email: t.String({ format: "email" }),
  name: t.String(),
  slug: t.Optional(t.String()),
  subscriptionStart: t.String({ format: "date-time" }),
  lastPayment: t.String({ format: "date-time" }),
  nextPayment: t.String({ format: "date-time" }),
  invitationEmailStatus: t.Optional(
    t.Union([t.Literal("sent"), t.Literal("failed"), t.Literal("pending")]),
  ),
  invitationEmailSentAt: t.Optional(t.String({ format: "date-time" })),
  invitationEmailError: t.Optional(t.String()),
  createdAt: t.Optional(t.String({ format: "date-time" })),
  updatedAt: t.Optional(t.String({ format: "date-time" })),
});

export type UnclaimedProfileSuccessResponse = Static<
  typeof UnclaimedProfileSuccessSchema
>;

const ErrorResponseSchema = t.Object({
  error: t.String(),
});

export const AttachImportedProfileBodySchema = t.Object({
  memberUid: t.String({
    minLength: 1,
    description: "The paid member UID to attach this imported profile to",
  }),
});

const AttachImportedProfileSuccessSchema = t.Object({
  success: t.Literal(true),
  memberUid: t.String(),
  email: t.String({ format: "email" }),
  status: t.Literal("merged"),
});

export type AttachImportedProfileSuccessResponse = Static<
  typeof AttachImportedProfileSuccessSchema
>;

export const AttachImportedProfileResponseSchema = t.Union([
  AttachImportedProfileSuccessSchema,
  ErrorResponseSchema,
]);

export type AttachImportedProfileResponse = Static<
  typeof AttachImportedProfileResponseSchema
>;

export const UnclaimedProfileResponseSchema = t.Union([
  UnclaimedProfileSuccessSchema,
  ErrorResponseSchema,
]);

export type UnclaimedProfileResponse = Static<
  typeof UnclaimedProfileResponseSchema
>;

const ListUnclaimedProfilesSuccessSchema = t.Object({
  profiles: t.Array(UnclaimedProfileSuccessSchema),
  total: t.Number(),
});

export type ListUnclaimedProfilesSuccessResponse = Static<
  typeof ListUnclaimedProfilesSuccessSchema
>;

export const ListUnclaimedProfilesResponseSchema = t.Union([
  ListUnclaimedProfilesSuccessSchema,
  ErrorResponseSchema,
]);

export type ListUnclaimedProfilesResponse = Static<
  typeof ListUnclaimedProfilesResponseSchema
>;

export const ListUnclaimedProfilesQuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 50 })),
  offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
});

export const EmailParameterSchema = t.Object({
  email: t.String({
    format: "email",
    description: "The email address of the unclaimed profile",
  }),
});

const SendInvitationSuccessSchema = t.Object({
  success: t.Boolean(),
  warning: t.Optional(
    t.String({
      description: "Warning message if email sent but tracking update failed",
    }),
  ),
});

export type SendInvitationSuccessResponse = Static<
  typeof SendInvitationSuccessSchema
>;

export const SendInvitationResponseSchema = t.Union([
  SendInvitationSuccessSchema,
  ErrorResponseSchema,
]);

export type SendInvitationResponse = Static<
  typeof SendInvitationResponseSchema
>;

export const ChangeEmailBodySchema = t.Object({
  newEmail: t.String({
    format: "email",
    description: "The new email address for the unclaimed profile",
  }),
});

const ChangeEmailAndResendSuccessSchema = t.Object({
  success: t.Boolean(),
  warning: t.Optional(
    t.String({
      description:
        "Warning message if email changed but resend had partial issues",
    }),
  ),
});

export type ChangeEmailAndResendSuccessResponse = Static<
  typeof ChangeEmailAndResendSuccessSchema
>;

export const ChangeEmailAndResendResponseSchema = t.Union([
  ChangeEmailAndResendSuccessSchema,
  ErrorResponseSchema,
]);

export type ChangeEmailAndResendResponse = Static<
  typeof ChangeEmailAndResendResponseSchema
>;

const UpdateEmailSuccessSchema = t.Object({
  success: t.Literal(true),
});

export type UpdateEmailSuccessResponse = Static<
  typeof UpdateEmailSuccessSchema
>;

export const UpdateEmailResponseSchema = t.Union([
  UpdateEmailSuccessSchema,
  ErrorResponseSchema,
]);

export type UpdateEmailResponse = Static<typeof UpdateEmailResponseSchema>;

const DeleteUnclaimedProfileSuccessSchema = t.Object({
  success: t.Literal(true),
  profileDrafted: t.Optional(t.Boolean()),
});

export type DeleteUnclaimedProfileSuccessResponse = Static<
  typeof DeleteUnclaimedProfileSuccessSchema
>;

export const DeleteUnclaimedProfileResponseSchema = t.Union([
  DeleteUnclaimedProfileSuccessSchema,
  ErrorResponseSchema,
]);

export type DeleteUnclaimedProfileResponse = Static<
  typeof DeleteUnclaimedProfileResponseSchema
>;

const RefreshPaymentDatesSuccessSchema = t.Object({
  success: t.Literal(true),
  updatedCount: t.Number(),
  totalCount: t.Number(),
});

export type RefreshPaymentDatesSuccessResponse = Static<
  typeof RefreshPaymentDatesSuccessSchema
>;

export const RefreshPaymentDatesResponseSchema = t.Union([
  RefreshPaymentDatesSuccessSchema,
  ErrorResponseSchema,
]);

export type RefreshPaymentDatesResponse = Static<
  typeof RefreshPaymentDatesResponseSchema
>;

export function toUnclaimedProfileResponse(
  document: UnclaimedProfileDocument,
): UnclaimedProfileSuccessResponse {
  return {
    email: document.email,
    name: document.name ?? "",
    ...(document.slug !== undefined && { slug: document.slug }),
    subscriptionStart: document.subscriptionStart.toDate().toISOString(),
    lastPayment: document.lastPayment.toDate().toISOString(),
    nextPayment: document.nextPayment.toDate().toISOString(),
    ...(document.invitationEmailStatus !== undefined && {
      invitationEmailStatus: document.invitationEmailStatus,
    }),
    ...(document.invitationEmailSentAt !== undefined && {
      invitationEmailSentAt: document.invitationEmailSentAt
        .toDate()
        .toISOString(),
    }),
    ...(document.invitationEmailError !== undefined && {
      invitationEmailError: document.invitationEmailError,
    }),
    ...(document.createdAt !== undefined && {
      createdAt: document.createdAt.toDate().toISOString(),
    }),
    ...(document.updatedAt !== undefined && {
      updatedAt: document.updatedAt.toDate().toISOString(),
    }),
  };
}
