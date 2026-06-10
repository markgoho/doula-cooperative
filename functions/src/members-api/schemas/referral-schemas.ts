import { t, type Static } from "elysia";
import type { MatchRequestDocument } from "../../collections/match-requests.js";
import { timestampToIso } from "../../shared-api/utils/timestamp-to-iso.js";

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
 * Convert Firestore document to list item (no contact info).
 */
export function toReferralListItem(
  id: string,
  document: MatchRequestDocument,
): ReferralListItem {
  return {
    id,
    submitted: timestampToIso(document.submitted),
    estimatedDueDate: document.estimatedDueDate,
    services: document.services,
    zipcode: document.zipcode,
    birthLocation: document.birthLocation,
  };
}

/**
 * Convert Firestore document to detail response (full contact info).
 */
export function toReferralDetail(
  id: string,
  document: MatchRequestDocument,
): ReferralDetail {
  return {
    id,
    name: document.name,
    email: document.email,
    phone: document.phone,
    zipcode: document.zipcode,
    estimatedDueDate: document.estimatedDueDate,
    services: document.services,
    birthLocation: document.birthLocation,
    otherInfo: document.otherInfo,
    insurance: document.insurance,
    submitted: timestampToIso(document.submitted),
  };
}
