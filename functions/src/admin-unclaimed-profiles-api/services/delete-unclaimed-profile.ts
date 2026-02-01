import { getFirestore } from "firebase-admin/firestore";
import { IMPORT_COLLECTION } from "../../collections/migrated-users-import.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";

/**
 * Delete an unclaimed profile from the migrated_users_import collection.
 * This is used to remove profiles for users who have cancelled their subscription
 * before claiming their account.
 */
export async function deleteUnclaimedProfile(options: {
  email: string;
  logger: Logger;
}): Promise<{ success: true }> {
  const { email, logger } = options;

  try {
    const firestore = getFirestore();
    const documentReference = firestore
      .collection(IMPORT_COLLECTION)
      .doc(email);
    const document = await documentReference.get();

    if (!document.exists) {
      logger.warn("Unclaimed profile not found", {
        errorId: ERROR_IDS.API_UNCLAIMED_PROFILE_NOT_FOUND,
        email,
      });
      throw new NotFoundError(
        `Unclaimed profile with email ${email} not found`,
      );
    }

    // Delete the document
    await documentReference.delete();

    logger.info("Unclaimed profile deleted successfully", {
      email,
    });

    return { success: true };
  } catch (error) {
    // Re-throw known HTTP errors (NotFoundError, etc.)
    if (error instanceof HttpError) {
      throw error;
    }

    // Log and re-throw unexpected Firestore errors
    logger.error("Failed to delete unclaimed profile from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_UPDATE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      email,
    });
    throw error;
  }
}
