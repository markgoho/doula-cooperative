import { t, type Static } from "elysia";
import { ErrorResponseSchema } from "./member-schemas.js";

/**
 * Referral list item schema - minimal fields for list display.
 * Contact info excluded; detail endpoint provides full data.
 */
export const ReferralListItemSchema = t.Object({
  id: t.String({ description: "Match request document ID" }),
  submitted: t.String({ format: "date-time", description: "ISO 8601 timestamp" }),
  estimatedDueDate: t.Object({
    month: t.String(),
    day: t.String(),
    year: t.String(),
  }),
  services: t.Array(t.String()),
  zipcode: t.String(),
  birthLocation: t.String(),
});

export type ReferralListItem = Static<typeof ReferralListItemSchema>;

/**
 * Referral detail schema - full request including contact info.
 * Only returned to active Stripe members.
 */
export const ReferralDetailSchema = t.Object({
  id: t.String({ description: "Match request document ID" }),
  name: t.String(),
  email: t.String({ format: "email" }),
  phone: t.String(),
  zipcode: t.String(),
  estimatedDueDate: t.Object({
    month: t.String(),
    day: t.String(),
    year: t.String(),
  }),
  services: t.Array(t.String()),
  birthLocation: t.String(),
  otherInfo: t.String(),
  insurance: t.Array(t.String()),
  submitted: t.String({ format: "date-time", description: "ISO 8601 timestamp" }),
});

export type ReferralDetail = Static<typeof ReferralDetailSchema>;

/**
 * List referrals response schema.
 */
export const ListReferralsResponseSchema = t.Object({
  referrals: t.Array(ReferralListItemSchema),
});

export type ListReferralsResponse = Static<typeof ListReferralsResponseSchema>;

/**
 * Request ID path parameter schema.
 */
export const ReferralRequestIdParameterSchema = t.Object({
  requestId: t.String({
    minLength: 1,
    maxLength: 128,
    description: "The Firestore document ID of the match request",
    error: "Request ID must be a non-empty string (max 128 characters)",
  }),
});

/**
 * Route response schema for GET /:memberId/referrals.
 * Unions success and error responses for HTTP contract enforcement.
 */
export const ListReferralsRouteResponseSchema = t.Union([
  ListReferralsResponseSchema,
  ErrorResponseSchema,
]);

/**
 * Route response schema for GET /:memberId/referrals/:requestId.
 * Unions success and error responses for HTTP contract enforcement.
 */
export const ReferralDetailRouteResponseSchema = t.Union([
  ReferralDetailSchema,
  ErrorResponseSchema,
]);
