import { t, type Static } from "elysia";

/**
 * Success response from Stripe webhook processing.
 */
export const StripeWebhookResponseSchema = t.Object({
  received: t.Literal(true, {
    description: "Indicates the webhook was received successfully",
  }),
  userId: t.Optional(
    t.String({
      description: "Firebase Auth user ID created or updated",
    }),
  ),
  isNewUser: t.Optional(
    t.Boolean({
      description: "Whether a new user was created",
    }),
  ),
  emailSent: t.Optional(
    t.Boolean({
      description: "Whether the welcome email was sent successfully",
    }),
  ),
  mailerliteSynced: t.Optional(
    t.Boolean({
      description: "Whether the user was added to MailerLite newsletter",
    }),
  ),
  duplicate: t.Optional(
    t.Boolean({
      description: "Whether this event was already processed (idempotency)",
    }),
  ),
  warning: t.Optional(
    t.String({
      description: "Warning message for non-critical failures",
    }),
  ),
});

export type StripeWebhookResponse = Static<typeof StripeWebhookResponseSchema>;

/**
 * Error response from Stripe webhook processing.
 */
export const StripeWebhookErrorResponseSchema = t.Object({
  error: t.String({
    description: "Error message describing what went wrong",
  }),
  errorId: t.Optional(
    t.String({
      description: "Error ID for Sentry tracking",
    }),
  ),
});

export type StripeWebhookErrorResponse = Static<
  typeof StripeWebhookErrorResponseSchema
>;

/**
 * Union type for Stripe webhook responses.
 */
export const StripeWebhookApiResponseSchema = t.Union([
  StripeWebhookResponseSchema,
  StripeWebhookErrorResponseSchema,
]);

export type StripeWebhookApiResponse = Static<
  typeof StripeWebhookApiResponseSchema
>;
