import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { MEMBERS_COLLECTION } from "../collections/index.js";
import { ERROR_IDS } from "../constants/error-ids.js";

interface CheckSlugAvailableRequest {
  slug: string;
}

export async function handleCheckSlugAvailable(
  request: CallableRequest<CheckSlugAvailableRequest>,
) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const uid = request.auth.uid;
  const { slug } = request.data;

  if (!slug || typeof slug !== "string") {
    throw new HttpsError("invalid-argument", "Slug is required.");
  }

  if (slug.length < 2) {
    throw new HttpsError(
      "invalid-argument",
      "Slug must be at least 2 characters long.",
    );
  }

  // Ensure slug contains at least one alphanumeric character and no consecutive/trailing hyphens
  const slugRegex = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  if (!slugRegex.test(slug)) {
    throw new HttpsError(
      "invalid-argument",
      "Slug must contain only lowercase letters, numbers, and hyphens. It must start and end with a letter or number.",
    );
  }

  logger.info(`Checking slug availability: ${slug} for user: ${uid}`);

  const database = getFirestore();
  const membersQuery = database
    .collection(MEMBERS_COLLECTION)
    .where("slug", "==", slug)
    .limit(1);

  try {
    const snapshot = await membersQuery.get();
    const isAvailable = snapshot.empty;

    logger.info(`Slug ${slug} availability: ${isAvailable}`);
    return { available: isAvailable };
  } catch (error: unknown) {
    logger.error("Firestore query failed in checkSlugAvailable", {
      errorId: ERROR_IDS.CHECK_SLUG_FIRESTORE_ERROR,
      uid,
      slug,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to check slug availability. Please try again.",
    );
  }
}
