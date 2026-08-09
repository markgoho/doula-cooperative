import type { ProfileData } from "../profiles-api/schemas/profile-schemas.js";

/**
 * Profiles collection: stores doula profile data as source of truth.
 * Documents are keyed by slug (e.g., profiles/jane-doe).
 */
export const PROFILES_COLLECTION = "profiles";

/**
 * Profile document stored in Firestore.
 * Extends ProfileData with metadata fields for timestamps and ownership.
 */
export interface ProfileDocument extends ProfileData {
  /**
  ISO 8601 timestamp when the profile was first created.
  */
  createdAt: string;
  /**
  ISO 8601 timestamp when the profile was last updated.
  */
  updatedAt: string;
  /**
  Firebase Auth UID of the profile owner. Undefined for unclaimed/migrated profiles.
  */
  ownerUid?: string;
}
