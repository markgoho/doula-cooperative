import { t, type Static } from "elysia";

/**
 * Profile webhook request body schema.
 */
export const ProfileWebhookBodySchema = t.Object({
  commitMessage: t.Optional(t.String()),
  commitSha: t.Optional(t.String()),
  slug: t.Optional(t.String()),
  secret: t.Optional(t.String()),
});

export type ProfileWebhookBody = Static<typeof ProfileWebhookBodySchema>;

/**
 * Success response from profile webhook processing.
 */
export const ProfileWebhookSuccessSchema = t.Object({
  status: t.Literal("success", {
    description: "Discriminant field indicating successful processing",
  }),
  received: t.Boolean({
    description: "Indicates the webhook was received successfully",
  }),
  notified: t.Boolean({
    description: "Whether the member was notified via email",
  }),
  reason: t.Optional(
    t.String({
      description: "Reason why notification was not sent",
    }),
  ),
});

export type ProfileWebhookSuccessResponse = Static<
  typeof ProfileWebhookSuccessSchema
>;

/**
 * Error response from profile webhook processing.
 */
export const ProfileWebhookErrorSchema = t.Object({
  status: t.Literal("error", {
    description: "Discriminant field indicating processing error",
  }),
  error: t.String({
    description: "Error message describing what went wrong",
  }),
});

export type ProfileWebhookErrorResponse = Static<
  typeof ProfileWebhookErrorSchema
>;

/**
 * Union type for profile webhook responses.
 */
export const ProfileWebhookResponseSchema = t.Union([
  ProfileWebhookSuccessSchema,
  ProfileWebhookErrorSchema,
]);

export type ProfileWebhookResponse = Static<
  typeof ProfileWebhookResponseSchema
>;
