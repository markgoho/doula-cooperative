import { t, type Static } from "elysia";
import { ErrorResponseSchema } from "./member-schemas.js";

/**
 * Referral list item schema - minimal fields for list display.
 * No requester name or contact info; the ZIP code is reduced to a "City, ST" area.
 */
export const ReferralListItemSchema = t.Object({
  id: t.String({ description: "Match request document ID" }),
  submitted: t.String({
    format: "date-time",
    description: "ISO 8601 timestamp",
  }),
  estimatedDueDate: t.Object({
    month: t.String(),
    day: t.String(),
    year: t.String(),
  }),
  services: t.Array(t.String()),
  area: t.String({
    description: '"City, ST" from the ZIP code; empty when no ZIP code',
  }),
  responseCount: t.Integer({
    minimum: 0,
    description:
      "Distinct doulas who sent Outreach or have an Offline Response",
  }),
});

export type ReferralListItem = Static<typeof ReferralListItemSchema>;

/**
 * Referral detail schema - the pre-Outreach view.
 * First name only: the requester's full name, email and phone are never included.
 */
export const ReferralDetailSchema = t.Object({
  id: t.String({ description: "Match request document ID" }),
  firstName: t.String({ description: "First word of the requester's name" }),
  zipcode: t.String(),
  area: t.String({
    description: '"City, ST" from the ZIP code; empty when no ZIP code',
  }),
  prefersSpanish: t.Boolean({
    description: "Whether the requester used the Spanish match form",
  }),
  responseCount: t.Integer({
    minimum: 0,
    description:
      "Distinct doulas who sent Outreach or have an Offline Response",
  }),
  estimatedDueDate: t.Object({
    month: t.String(),
    day: t.String(),
    year: t.String(),
  }),
  services: t.Array(t.String()),
  birthLocation: t.String(),
  otherInfo: t.String(),
  insurance: t.Array(t.String()),
  submitted: t.String({
    format: "date-time",
    description: "ISO 8601 timestamp",
  }),
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
