import { getFirestore } from "firebase-admin/firestore";
import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "../../../collections/index.js";
import {
  HttpError,
  NotFoundError,
} from "../../../shared-api/errors/http-error.js";
import type { WriteProfileResponse } from "./interface.js";

/**
 * Firestore gRPC status code for NOT_FOUND.
 * Thrown by update() when the document does not exist.
 */
const NOT_FOUND_CODE = 5;

/**
 * Record when a profile's image last changed.
 *
 * The public site builds ImageKit URLs from the slug alone, so replacing a
 * photo leaves the URL unchanged and visitors keep the cached image for as
 * long as its year-long max-age allows. This timestamp reaches the Hugo front
 * matter and is appended to those URLs as a version, so a new photo gets a new
 * URL instead of depending on cache invalidation.
 */
export async function stampProfileImageUpdated(options: {
  slug: string;
}): Promise<WriteProfileResponse> {
  const { slug } = options;

  try {
    const updates: Partial<ProfileDocument> = {
      imageUpdatedAt: new Date().toISOString(),
    };

    await getFirestore()
      .collection(PROFILES_COLLECTION)
      .doc(slug)
      .update(updates);

    return { success: true };
  } catch (error: unknown) {
    if (
      error !== null &&
      typeof error === "object" &&
      "code" in error &&
      error.code === NOT_FOUND_CODE
    ) {
      throw new NotFoundError(`No profile exists for slug: ${slug}`);
    }

    throw new HttpError(`Failed to record profile image update: ${slug}`, 500);
  }
}
