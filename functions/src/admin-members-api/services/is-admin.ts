import { getAuth } from "firebase-admin/auth";
import type { Logger } from "../../shared-api/types/logger.js";

/**
 * Check if a user has admin privileges via Firebase Auth custom claims.
 *
 * @param uid - The user's UID
 * @param logger - Logger for error reporting
 * @returns Promise resolving to true if user has admin claim, false otherwise
 */
export async function isAdmin(uid: string, logger: Logger): Promise<boolean> {
  try {
    const auth = getAuth();
    const userRecord = await auth.getUser(uid);
    return userRecord.customClaims?.["admin"] === true;
  } catch (error) {
    // User might not exist in Auth, log warning and return false
    logger.warn("Failed to check admin status for user", {
      uid,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
}
