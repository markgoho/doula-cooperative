import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../../collections/index.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import { buildProfileImageUrl } from "../../../constants/imagekit.js";
import {
  HttpError,
  NotFoundError,
} from "../../../shared-api/errors/http-error.js";
import type { ReadProfileResponse } from "./interface.js";

/**
 * Read a profile from the Firestore profiles collection.
 * Image URL is derived deterministically from the slug.
 */
export async function readProfile(options: {
  slug: string;
}): Promise<ReadProfileResponse> {
  const { slug } = options;

  try {
    const firestore = getFirestore();
    const document = await firestore
      .collection(PROFILES_COLLECTION)
      .doc(slug)
      .get();

    if (!document.exists) {
      throw new NotFoundError("Profile not found");
    }

    const data = document.data() as ProfileDocument;

    return {
      title: data.title,
      bio: data.bio,
      draft: data.draft ?? false,
      ...(data.credentials && { credentials: data.credentials }),
      ...(data.pronouns && { pronouns: data.pronouns }),
      ...(data.tags && { tags: data.tags }),
      ...(data.contact && { contact: data.contact }),
      ...(data.ownerUid && { ownerUid: data.ownerUid }),
      image: buildProfileImageUrl(slug),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to read profile from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to read profile", 500);
  }
}
