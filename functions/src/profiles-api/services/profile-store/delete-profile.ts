import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { PROFILES_COLLECTION } from "../../../collections/index.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError } from "../../../shared-api/errors/http-error.js";
import type { WriteProfileResponse } from "./interface.js";

/**
 * Delete a profile document from Firestore.
 * Handles non-existent documents gracefully (idempotent).
 */
export async function deleteProfile(options: {
  slug: string;
}): Promise<WriteProfileResponse> {
  const { slug } = options;

  try {
    const firestore = getFirestore();
    const documentReference = firestore
      .collection(PROFILES_COLLECTION)
      .doc(slug);

    const existing = await documentReference.get();
    if (!existing.exists) {
      logger.info("Profile not found in Firestore, skipping delete", { slug });
      return { success: true };
    }

    await documentReference.delete();

    logger.info("Successfully deleted profile", { slug });
    return { success: true };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to delete profile from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_UPDATE_FAILED,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to delete profile", 500);
  }
}
