import { t, type Static } from "elysia";
import {
  ErrorResponseSchema,
  MemberIdParameterSchema,
} from "./member-schemas.js";

/**
 * A Referral Outcome as the API names it (see `ReferralOutcome`).
 */
export const ReferralOutcomeSchema = t.Union(
  [t.Literal("hired"), t.Literal("not_hired"), t.Literal("not_a_fit")],
  { error: "Outcome must be one of: hired, not_hired, not_a_fit" },
);

/**
 * The viewer's own Referral Outcome and the hired badge. Other Members'
 * names and non-hired Outcomes are never included.
 */
const OutcomeFields = {
  outcome: t.Optional(ReferralOutcomeSchema),
  outcomeUpdatedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "When your Referral Outcome was last set (ISO 8601)",
    }),
  ),
  hiredBadge: t.Boolean({
    description: "Whether any Member recorded a hired Referral Outcome",
  }),
};

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
 * The Offline Response a Referral Coordinator recorded for the viewer.
 * Unlocks the viewer's Referral Outcome; never reveals contact details.
 */
export const OwnOfflineResponseSchema = t.Object({
  recordedAt: t.String({
    format: "date-time",
    description: "When the Offline Response was recorded (ISO 8601)",
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
 * One Member who sent Outreach on a Referral, as the Coordinator panel lists it.
 */
export const ReferralResponseSchema = t.Object({
  memberUid: t.String(),
  memberName: t.String({ description: "The Member's name; empty when unset" }),
  outreachSentAt: t.String({
    format: "date-time",
    description: "When Mailgun accepted the Outreach (ISO 8601)",
  }),
  outcome: t.Optional(ReferralOutcomeSchema),
  outcomeUpdatedAt: t.Optional(
    t.String({
      format: "date-time",
      description: "When the Referral Outcome was last set (ISO 8601)",
    }),
  ),
});

export type ReferralResponse = Static<typeof ReferralResponseSchema>;

/**
 * Which kind of doula an Offline Response names: a Member, or an Unclaimed
 * Legacy Membership ("Not yet migrated").
 */
export const ReferralDoulaKindSchema = t.Union(
  [t.Literal("member"), t.Literal("legacy")],
  { error: "Kind must be one of: member, legacy" },
);

export type ReferralDoulaKind = Static<typeof ReferralDoulaKindSchema>;

/**
 * Id of a doula in the picker: a Member's uid, or an opaque id for an
 * Unclaimed Legacy Membership (never its email).
 */
const ReferralDoulaIdSchema = t.String({
  minLength: 1,
  maxLength: 128,
  error: "Doula id must be a non-empty string (max 128 characters)",
});

/**
 * One Offline Response on a Referral, as the Coordinator panel lists it.
 */
export const OfflineResponseRowSchema = t.Object({
  kind: ReferralDoulaKindSchema,
  id: ReferralDoulaIdSchema,
  displayName: t.String({ description: "The doula's name; empty when unset" }),
  recordedAt: t.String({
    format: "date-time",
    description: "When the Offline Response was recorded (ISO 8601)",
  }),
  recordedByName: t.String({
    description:
      "Name of the Referral Coordinator who recorded it; empty when unset",
  }),
  canDelete: t.Boolean({
    description: "Whether the viewer may delete this Offline Response",
  }),
  outcome: t.Optional(ReferralOutcomeSchema),
});

export type OfflineResponseRow = Static<typeof OfflineResponseRowSchema>;

/**
 * Coordinator-only part of a Referral detail: who sent Outreach, each
 * Member's Referral Outcome, and the Offline Responses. Present only for
 * Referral Coordinators and Admins. Never carries the requester's contact
 * details.
 */
export const ReferralCoordinatorViewSchema = t.Object({
  responses: t.Array(ReferralResponseSchema, {
    description: "Members who sent Outreach, earliest first",
  }),
  offlineResponses: t.Array(OfflineResponseRowSchema, {
    description: "Offline Responses, earliest first",
  }),
  canRecordOfflineResponses: t.Boolean({
    description:
      "Whether the viewer may record Offline Responses (Referral Coordinators only)",
  }),
});

export type ReferralCoordinatorView = Static<
  typeof ReferralCoordinatorViewSchema
>;

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
  offlineResponse: t.Optional(OwnOfflineResponseSchema),
  outcome: OutcomeFields.outcome,
  hiredBadge: OutcomeFields.hiredBadge,
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
  isOpen: t.Boolean({
    description:
      "Whether the Referral is under 14 days old; Outreach can only be sent while it is",
  }),
  outreach: t.Optional(OwnOutreachSchema),
  offlineResponse: t.Optional(OwnOfflineResponseSchema),
  contact: t.Optional(ReferralContactSchema),
  outreachSender: t.Optional(OutreachSenderSchema),
  coordinator: t.Optional(ReferralCoordinatorViewSchema),
  ...OutcomeFields,
});

export type ReferralDetail = Static<typeof ReferralDetailSchema>;

/**
 * List referrals response schema.
 */
export const ListReferralsResponseSchema = t.Object({
  referrals: t.Array(ReferralListItemSchema),
  showsAllReferrals: t.Boolean({
    description:
      "Whether the list holds every Referral regardless of age (newest 200), as Referral Coordinators see it",
  }),
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
 * PUT /:memberId/referrals/:requestId/outcome body.
 */
export const SetReferralOutcomeBodySchema = t.Object({
  outcome: ReferralOutcomeSchema,
});

/**
 * The viewer's Referral Outcome after a set or clear, with the hired badge
 * recomputed. After a clear, `outcome` and `outcomeUpdatedAt` are absent.
 */
export const ReferralOutcomeResponseSchema = t.Object(OutcomeFields);

export type ReferralOutcomeResponse = Static<
  typeof ReferralOutcomeResponseSchema
>;

/**
 * Route response schema for PUT and DELETE /:memberId/referrals/:requestId/outcome.
 */
export const ReferralOutcomeRouteResponseSchema = t.Union([
  ReferralOutcomeResponseSchema,
  ErrorResponseSchema,
]);

/**
 * One doula the Referral Coordinator can name in an Offline Response.
 * Display name and id only.
 */
export const ReferralDoulaSchema = t.Object({
  kind: ReferralDoulaKindSchema,
  id: ReferralDoulaIdSchema,
  displayName: t.String(),
});

export type ReferralDoula = Static<typeof ReferralDoulaSchema>;

/**
 * GET /:memberId/referral-doulas response: Members and Unclaimed Legacy
 * Memberships, sorted by name.
 */
export const ListReferralDoulasResponseSchema = t.Object({
  doulas: t.Array(ReferralDoulaSchema),
});

export type ListReferralDoulasResponse = Static<
  typeof ListReferralDoulasResponseSchema
>;

export const ListReferralDoulasRouteResponseSchema = t.Union([
  ListReferralDoulasResponseSchema,
  ErrorResponseSchema,
]);

/**
 * POST /:memberId/referrals/:requestId/offline-responses body: the doula, as
 * the picker lists it.
 */
export const RecordOfflineResponseBodySchema = t.Object({
  kind: ReferralDoulaKindSchema,
  id: ReferralDoulaIdSchema,
});

/**
 * DELETE /:memberId/referrals/:requestId/offline-responses/:kind/:id params.
 */
export const OfflineResponseParameterSchema = t.Object({
  memberId: MemberIdParameterSchema.properties.memberId,
  requestId: ReferralRequestIdParameterSchema.properties.requestId,
  kind: ReferralDoulaKindSchema,
  id: ReferralDoulaIdSchema,
});

/** The Offline Response just recorded, as the Coordinator panel lists it. */
export const RecordOfflineResponseResponseSchema = t.Object({
  offlineResponse: OfflineResponseRowSchema,
});

export type RecordOfflineResponseResponse = Static<
  typeof RecordOfflineResponseResponseSchema
>;

export const RecordOfflineResponseRouteResponseSchema = t.Union([
  RecordOfflineResponseResponseSchema,
  ErrorResponseSchema,
]);

export const DeleteOfflineResponseResponseSchema = t.Object({
  deleted: t.Literal(true),
});

export type DeleteOfflineResponseResponse = Static<
  typeof DeleteOfflineResponseResponseSchema
>;

export const DeleteOfflineResponseRouteResponseSchema = t.Union([
  DeleteOfflineResponseResponseSchema,
  ErrorResponseSchema,
]);

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
