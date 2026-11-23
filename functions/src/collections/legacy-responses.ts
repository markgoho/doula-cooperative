import type { Timestamp } from "firebase-admin/firestore";
import type { ReferralOutcome } from "./member-responses.js";

/**
 * Subcollection of a Match Request: one Offline Response per Unclaimed Legacy
 * Membership, keyed by the Legacy Membership's email (its
 * `migrated_users_import` document ID)
 * (`matchRequests/{requestId}/legacyResponses/{legacyEmail}`).
 *
 * When an Admin links the Legacy Membership to a Member, the document moves
 * to that Member's `memberResponses/{uid}.offlineResponse`, and its Referral
 * Outcome to that Member's `outcome` unless they already have one.
 */
export const LEGACY_RESPONSES_SUBCOLLECTION = "legacyResponses";

/**
 * A Referral Coordinator's record that an Unclaimed Legacy Membership
 * responded to a Referral outside the member portal. By itself it records only
 * that they responded, not a hire. Since the doula has no portal account, a
 * Referral Coordinator may also record their Referral Outcome here.
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
  /** The doula's current Referral Outcome, recorded by a Referral Coordinator; absent when none or cleared. No history. */
  outcome?: ReferralOutcome;
  /** When `outcome` was last set (server time); cleared along with it. */
  outcomeUpdatedAt?: Timestamp;
  /** uid of the Referral Coordinator who last set `outcome`; cleared along with it. */
  outcomeRecordedBy?: string;
}
