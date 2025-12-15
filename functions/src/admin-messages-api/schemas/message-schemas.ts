import { t, type Static } from "elysia";
import type { MessageDocument } from "../../collections/messages.js";

/**
 * Message response schema (API representation with ISO dates)
 */
export const MessageResponseSchema = t.Object({
  id: t.String({ description: "Message document ID" }),
  contactName: t.String(),
  email: t.String({ format: "email" }),
  message: t.String(),
  submitted: t.String({
    format: "date-time",
    description: "ISO 8601 timestamp",
  }),
  sent: t.Boolean(),
  recaptchaScore: t.Optional(t.Number()),
});

export type MessageResponse = Static<typeof MessageResponseSchema>;

/**
 * List response with pagination metadata
 */
export const ListMessagesResponseSchema = t.Object({
  messages: t.Array(MessageResponseSchema),
  total: t.Number(),
  pendingCount: t.Number(),
  processedCount: t.Number(),
});

export type ListMessagesResponse = Static<typeof ListMessagesResponseSchema>;

/**
 * Query parameters for list endpoint
 */
export const ListMessagesQuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 50 })),
  offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
  status: t.Optional(
    t.Union(
      [t.Literal("pending"), t.Literal("processed"), t.Literal("all")],
      { default: "all" },
    ),
  ),
});

export type ListMessagesQuery = Static<typeof ListMessagesQuerySchema>;

/**
 * Message ID parameter schema
 */
export const MessageIdParameterSchema = t.Object({
  messageId: t.String({
    minLength: 1,
    maxLength: 128,
    description: "The Firestore document ID of the message",
    error: "Message ID must be a non-empty string",
  }),
});

/**
 * Update message body schema
 */
export const UpdateMessageBodySchema = t.Object({
  sent: t.Boolean({
    description: "Whether the message has been processed/sent",
  }),
});

export type UpdateMessageBody = Static<typeof UpdateMessageBodySchema>;

/**
 * Success response for updates
 */
export const UpdateMessageResponseSchema = t.Object({
  success: t.Literal(true),
});

export type UpdateMessageResponse = Static<typeof UpdateMessageResponseSchema>;

/**
 * Conversion helper: Firestore document + id -> API response
 */
export function toMessageResponse(
  id: string,
  document: MessageDocument,
): MessageResponse {
  return {
    id,
    contactName: document.contactName,
    email: document.email,
    message: document.message,
    submitted: document.submitted.toDate().toISOString(),
    sent: document.sent,
    ...(document.recaptchaScore !== undefined && {
      recaptchaScore: document.recaptchaScore,
    }),
  };
}
