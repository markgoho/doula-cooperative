import { createHash } from "node:crypto";

/**
 * The opaque id the members app uses for an Unclaimed Legacy Membership.
 *
 * Legacy Memberships are keyed by email, which must not reach the members app,
 * so the API sends a stable hash of the document ID instead and resolves it
 * back on the server (against `migrated_users_import` to record, and against
 * the Referral's `legacyResponses` to delete).
 *
 * @param legacyEmail - The `migrated_users_import` document ID, as stored
 */
export function toLegacyDoulaId(legacyEmail: string): string {
  return createHash("sha256")
    .update(`legacy-membership:${legacyEmail}`)
    .digest("hex")
    .slice(0, 32);
}
