import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../../collections/index.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { ConflictError, HttpError } from "../../../shared-api/errors/http-error.js";
import type { ProfileData } from "../../schemas/profile-schemas.js";
import type { WriteProfileResponse } from "./interface.js";

/**
 * Create a new profile in the Firestore profiles collection.
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

    const existing = await documentReference.get();
    if (existing.exists) {
      throw new ConflictError(
        "Profile already exists. Use the update endpoint instead.",
      );
    }

    const now = new Date().toISOString();

    const profileDocument: ProfileDocument = {
      title: data.title,
      bio: data.bio,
      draft: true,
      createdAt: now,
      updatedAt: now,
      ...(data.credentials && { credentials: data.credentials }),
      ...(data.pronouns && { pronouns: data.pronouns }),
      ...(data.tags && { tags: data.tags }),
      ...(data.contact && { contact: data.contact }),
      ...(ownerUid && { ownerUid }),
    };

    await documentReference.set(profileDocument);

    logger.info("Successfully created profile", { slug });
    return { success: true };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
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
