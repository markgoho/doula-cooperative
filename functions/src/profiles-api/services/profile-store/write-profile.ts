import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../../collections/index.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import {
  HttpError,
  NotFoundError,
} from "../../../shared-api/errors/http-error.js";
import type { ProfileData } from "../../schemas/profile-schemas.js";
import type { WriteProfileResponse } from "./interface.js";

/**
 * Firestore gRPC status code for NOT_FOUND.
 * Thrown by update() when the document does not exist.
 */
const NOT_FOUND_CODE = 5;

/**
 * Update an existing profile in the Firestore profiles collection.
 * Sets updatedAt to current time.
 * Uses Firestore update() which natively throws NOT_FOUND if the document is missing,
 * avoiding an extra read.
 */
export async function writeProfile(options: {
  slug: string;
  data: ProfileData;
}): Promise<WriteProfileResponse> {
  const { slug, data } = options;

  try {
    const firestore = getFirestore();
    const documentReference = firestore
      .collection(PROFILES_COLLECTION)
      .doc(slug);

    const updates: Partial<ProfileDocument> = {
      title: data.title,
      bio: data.bio,
      updatedAt: new Date().toISOString(),
    };

    if (data.draft !== undefined) {
      updates.draft = data.draft;
    }
    if (data.credentials !== undefined) {
      updates.credentials = data.credentials;
    }
    if (data.pronouns !== undefined) {
      updates.pronouns = data.pronouns;
    }
    if (data.tags !== undefined) {
      updates.tags = data.tags;
    }
    if (data.contact !== undefined) {
      updates.contact = data.contact;
    }

    await documentReference.update(updates);

    logger.info("Successfully updated profile", { slug });
    return { success: true };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    if (isFirestoreNotFoundError(error)) {
      throw new NotFoundError("Profile not found");
    }

    logger.error("Failed to write profile to Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_UPDATE_FAILED,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to update profile", 500);
  }
}

/**
 * Checks if a Firestore error is a NOT_FOUND error (gRPC code 5).
 */
function isFirestoreNotFoundError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    error.code === NOT_FOUND_CODE
  );
}
