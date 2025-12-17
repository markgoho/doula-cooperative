import { getFirestore } from "firebase-admin/firestore";
import {
  IMPORT_COLLECTION,
  type UnclaimedProfileDocument,
} from "../../collections/migrated-users-import.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  HttpError,
  NotFoundError,
} from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  toUnclaimedProfileResponse,
  type UnclaimedProfileSuccessResponse,
} from "../schemas/unclaimed-profile-schemas.js";

export async function getUnclaimedProfile(options: {
  email: string;
  logger: Logger;
}): Promise<UnclaimedProfileSuccessResponse> {
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

    const documentData = document.data() as Record<string, unknown>;
    const profile: UnclaimedProfileDocument = {
      ...(documentData as Omit<UnclaimedProfileDocument, "email">),
      email: document.id,
    };

    return toUnclaimedProfileResponse(profile);
  } catch (error) {
    // Re-throw known HTTP errors (NotFoundError, etc.)
    if (error instanceof HttpError) {
      throw error;
    }

    // Log and re-throw unexpected Firestore errors
    logger.error("Failed to read unclaimed profile from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      email,
    });
    throw error;
  }
}
