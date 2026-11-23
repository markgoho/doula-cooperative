import { t, type Static } from "elysia";
import { ErrorResponseSchema } from "./member-schemas.js";

/**
 * The requester's own Outreach on a Referral. Present only when they sent it.
 */
export const OwnOutreachSchema = t.Object({
  sentAt: t.String({
    format: "date-time",
    description: "When Mailgun accepted the Outreach (ISO 8601)",
  }),
});

/**
 * The requester's contact details, revealed only after the viewer's own Outreach.
 */
export const ReferralContactSchema = t.Object({
  fullName: t.String(),
  email: t.String(),
  phone: t.String(),
});

/**
 * Who the Outreach email comes from, for the composer's template and hint.
 * Present only before the viewer's own Outreach, when the viewer can send it.
 */
export const OutreachSenderSchema = t.Object({
  name: t.String({ description: "The Member's name; empty when unset" }),
  email: t.String({ description: "Replies and the BCC copy go here" }),
  profileUrl: t.Optional(
    t.String({ description: "Published Doula Profile URL" }),
  ),
});

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
  isOpen: t.Boolean({
    description: "Whether the Referral is under 14 days old",
  }),
  outreach: t.Optional(OwnOutreachSchema),
});

export type ReferralListItem = Static<typeof ReferralListItemSchema>;

/**
 * Referral detail schema.
 * Before the viewer's own Outreach: first name only, never the requester's
 * full name, email or phone. After it: `outreach` and `contact` are added.
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
  outreach: t.Optional(OwnOutreachSchema),
  contact: t.Optional(ReferralContactSchema),
  outreachSender: t.Optional(OutreachSenderSchema),
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

/** Longest Outreach message accepted. */
export const OUTREACH_MESSAGE_MAX_LENGTH = 5000;

/**
 * POST /:memberId/referrals/:requestId/outreach body.
 * Emptiness after trimming is checked in the route so it gets a clear 400.
 */
export const SendOutreachBodySchema = t.Object({
  message: t.String({
    maxLength: OUTREACH_MESSAGE_MAX_LENGTH,
    error: `Message must be at most ${OUTREACH_MESSAGE_MAX_LENGTH} characters`,
  }),
});

/**
 * Outreach accepted: the sent time and the now-revealed contact details.
 */
export const SendOutreachResponseSchema = t.Object({
  outreach: OwnOutreachSchema,
  contact: ReferralContactSchema,
});

export type SendOutreachResponse = Static<typeof SendOutreachResponseSchema>;

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

/**
 * Route response schema for POST /:memberId/referrals/:requestId/outreach.
 */
export const SendOutreachRouteResponseSchema = t.Union([
  SendOutreachResponseSchema,
  ErrorResponseSchema,
]);
