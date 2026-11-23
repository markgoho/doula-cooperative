import { t, type Static } from "elysia";
import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";

/**
 * Match request response schema (API representation with ISO dates)
 */
export const MatchRequestResponseSchema = t.Object({
  id: t.String({ description: "Match request document ID" }),
  name: t.String(),
  phone: t.String(),
  email: t.String({ format: "email" }),
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
  submitted: t.String({
    format: "date-time",
    description: "ISO 8601 timestamp",
  }),
  sent: t.Boolean(),
  recaptchaScore: t.Optional(t.Number()),
});

export type MatchRequestResponse = Static<typeof MatchRequestResponseSchema>;

const ReferralOutcomeSchema = t.Union([
  t.Literal("hired"),
  t.Literal("not_hired"),
  t.Literal("not_a_fit"),
]);

/** Who recorded a Member's Offline Response, and when. */
const MemberOfflineResponseSchema = t.Object({
  recordedByName: t.String(),
  recordedAt: t.String({ format: "date-time" }),
});

/**
 * One Member's response to a Referral: Outreach, an Offline Response recorded
 * by a Referral Coordinator, or both, plus their current Referral Outcome.
 * A name that can't be resolved is "".
 */
export const MemberReferralResponseSchema = t.Object({
  memberUid: t.String(),
  memberName: t.String(),
  outreachSentAt: t.Optional(t.String({ format: "date-time" })),
  outcome: t.Optional(ReferralOutcomeSchema),
  outcomeUpdatedAt: t.Optional(t.String({ format: "date-time" })),
  offlineResponse: t.Optional(MemberOfflineResponseSchema),
});

export type MemberReferralResponse = Static<
  typeof MemberReferralResponseSchema
>;

/**
 * An Offline Response recorded for an Unclaimed Legacy Membership. The
 * Legacy Membership's email is never included.
 */
export const LegacyReferralResponseSchema = t.Object({
  displayName: t.String(),
  recordedByName: t.String(),
  recordedAt: t.String({ format: "date-time" }),
  /** The Referral Outcome a Referral Coordinator recorded for this doula, if any. */
  outcome: t.Optional(ReferralOutcomeSchema),
  outcomeUpdatedAt: t.Optional(t.String({ format: "date-time" })),
});

export type LegacyReferralResponse = Static<
  typeof LegacyReferralResponseSchema
>;

export const MatchRequestResponsesSchema = t.Object({
  members: t.Array(MemberReferralResponseSchema),
  legacy: t.Array(LegacyReferralResponseSchema),
});

export type MatchRequestResponses = Static<typeof MatchRequestResponsesSchema>;

/**
 * Detail response: the match request plus every Outreach, Referral Outcome,
 * and Offline Response on it.
 */
export type MatchRequestDetailResponse = MatchRequestResponse & {
  responses: MatchRequestResponses;
};

/**
 * List response with pagination metadata
 */
export const ListMatchRequestsResponseSchema = t.Object({
  requests: t.Array(MatchRequestResponseSchema),
  total: t.Number(),
  pendingCount: t.Number(),
  processedCount: t.Number(),
});

export type ListMatchRequestsResponse = Static<
  typeof ListMatchRequestsResponseSchema
>;

const MatchRequestStatusFilterSchema = t.Union(
  [t.Literal("pending"), t.Literal("processed"), t.Literal("all")],
  { default: "all" },
);

/**
 * Query parameters for list endpoint
 */
export const ListMatchRequestsQuerySchema = t.Object({
  limit: t.Optional(t.Number({ minimum: 1, maximum: 100, default: 50 })),
  offset: t.Optional(t.Number({ minimum: 0, default: 0 })),
  status: t.Optional(MatchRequestStatusFilterSchema),
});

export type ListMatchRequestsQuery = Static<
  typeof ListMatchRequestsQuerySchema
>;

/**
 * Request ID parameter schema
 */
export const RequestIdParameterSchema = t.Object({
  requestId: t.String({
    minLength: 1,
    maxLength: 128,
    description: "The Firestore document ID of the match request",
    error: "Request ID must be a non-empty string",
  }),
});

/**
 * Update request body schema
 */
export const UpdateMatchRequestBodySchema = t.Object({
  sent: t.Boolean({
    description: "Whether the match request has been processed/sent",
  }),
});

export type UpdateMatchRequestBody = Static<
  typeof UpdateMatchRequestBodySchema
>;

/**
 * Success response for updates
 */
export const UpdateMatchRequestResponseSchema = t.Object({
  success: t.Literal(true),
});

export type UpdateMatchRequestResponse = Static<
  typeof UpdateMatchRequestResponseSchema
>;

/**
 * Conversion helper: Firestore document + id -> API response
 */
export function toMatchRequestResponse(
  id: string,
  document: MatchRequestDocument,
): MatchRequestResponse {
  return {
    id,
    name: document.name,
    phone: document.phone,
    email: document.email,
    zipcode: document.zipcode,
    estimatedDueDate: document.estimatedDueDate,
    services: document.services,
    birthLocation: document.birthLocation,
    otherInfo: document.otherInfo,
    insurance: document.insurance,
    submitted: timestampToIso(document.submitted),
    sent: document.sent,
    ...(document.recaptchaScore !== undefined && {
      recaptchaScore: document.recaptchaScore,
    }),
  };
}
