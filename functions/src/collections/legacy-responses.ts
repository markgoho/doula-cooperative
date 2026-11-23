import type { Timestamp } from "firebase-admin/firestore";

/**
 * Subcollection of a Match Request: one Offline Response per Unclaimed Legacy
 * Membership, keyed by the Legacy Membership's email (its
 * `migrated_users_import` document ID)
 * (`matchRequests/{requestId}/legacyResponses/{legacyEmail}`).
 *
 * When an Admin links the Legacy Membership to a Member, the document moves
 * to that Member's `memberResponses/{uid}.offlineResponse`.
 */
export const LEGACY_RESPONSES_SUBCOLLECTION = "legacyResponses";

/**
 * A Referral Coordinator's record that an Unclaimed Legacy Membership
 * responded to a Referral outside the member portal. Records only that they
 * responded, not a hire.
 */
export interface LegacyResponseDocument {
  /** The Legacy Membership's email (also the document ID). Never sent to the members app. */
  legacyEmail: string;
  /** The Legacy Membership's name when recorded, so the record outlives the import document. */
  displayName: string;
  /** uid of the Referral Coordinator who recorded it. */
  recordedBy: string;
  /** When it was recorded (server time). */
  recordedAt: Timestamp;
}
