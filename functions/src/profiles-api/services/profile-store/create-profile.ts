import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "@doula-coop/functions-shared/collections/index.js";
import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import {
  ConflictError,
  HttpError,
} from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import type { ProfileData } from "../../schemas/profile-schemas.js";
import type { WriteProfileResponse } from "./interface.js";

/**
 * Firestore error code for document already exists.
 * Thrown by DocumentReference.create() when the document already exists.
 */
const ALREADY_EXISTS_CODE = 6;

/**
 * Create a new profile in the Firestore profiles collection.
 * Uses Firestore's create() for atomic uniqueness enforcement — no race conditions.
 * New profiles start as draft: true with timestamps.
 */
export async function createProfile(options: {
  slug: string;
  data: ProfileData;
  ownerUid?: string;
}): Promise<WriteProfileResponse> {
  const { slug, data, ownerUid } = options;

  try {
    const firestore = getFirestore();
    const documentReference = firestore
      .collection(PROFILES_COLLECTION)
      .doc(slug);

    const now = new Date().toISOString();

    const profileDocument: ProfileDocument = {
      title: data.title,
      bio: data.bio,
      draft: true,
      createdAt: now,
      updatedAt: now,
      ...(data.credentials !== undefined && { credentials: data.credentials }),
      ...(data.pronouns !== undefined && { pronouns: data.pronouns }),
      ...(data.tags !== undefined && { tags: data.tags }),
      ...(data.contact !== undefined && { contact: data.contact }),
      ...(ownerUid !== undefined && { ownerUid }),
    };

    // create() is atomic — throws ALREADY_EXISTS if the document exists
    await documentReference.create(profileDocument);

    logger.info("Successfully created profile", { slug });
    return { success: true };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    // Firestore create() throws with code 6 (ALREADY_EXISTS) if the document exists
    if (isFirestoreAlreadyExistsError(error)) {
      throw new ConflictError(
        "Profile already exists. Use the update endpoint instead.",
      );
    }

    logger.error("Failed to create profile in Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_UPDATE_FAILED,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to create profile", 500);
  }
}

function isFirestoreAlreadyExistsError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code: unknown }).code === ALREADY_EXISTS_CODE
  );
}
