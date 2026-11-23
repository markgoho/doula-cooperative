import { getAuth } from "firebase-admin/auth";
import type { Logger } from "../../shared-api/types/logger.js";

/**
 * Check if a user holds the Referral Coordinator role via Firebase Auth custom claims.
 *
 * @param uid - The user's UID
 * @param logger - Logger for error reporting
 * @returns Promise resolving to true if user has the referralCoordinator claim, false otherwise
 */
export async function isReferralCoordinator(
  uid: string,
  logger: Logger,
): Promise<boolean> {
  try {
    const userRecord = await getAuth().getUser(uid);
    return userRecord.customClaims?.["referralCoordinator"] === true;
  } catch (error) {
    // User might not exist in Auth, log warning and return false
    logger.warn("Failed to check Referral Coordinator status for user", {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
