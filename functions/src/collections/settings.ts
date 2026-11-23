import type { Timestamp } from "firebase-admin/firestore";

/**
 * Settings collection: global, server-read configuration documents.
 * Clients never read this collection; the members app learns
 * availability from API responses.
 */
export const SETTINGS_COLLECTION = "settings";

/**
 * Document ID of the Referral Portal v2 rollout gate in the settings collection.
 * A missing document means the gate is off.
 */
export const REFERRAL_PORTAL_SETTINGS_DOC_ID = "referralPortal";

export interface ReferralPortalSettingsDocument {
  v2Enabled: boolean;
  updatedAt: Timestamp;
  /** UID of the Admin who last flipped the switch */
  updatedBy: string;
}
