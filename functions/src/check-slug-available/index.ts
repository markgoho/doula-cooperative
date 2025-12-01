import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { MEMBERS_COLLECTION } from "../collections/index.js";

interface CheckSlugAvailableRequest {
  slug: string;
}

export async function handleCheckSlugAvailable(
  request: CallableRequest<CheckSlugAvailableRequest>,
) {
  // 1. Check for Firebase authenticated user
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const uid = request.auth.uid;
  const { slug } = request.data;

  // 2. Validate input
  if (!slug || typeof slug !== "string") {
    throw new HttpsError("invalid-argument", "Slug is required.");
  }

  // 3. Check if slug is valid format (lowercase, alphanumeric, hyphens only)
  const slugRegex = /^[a-z0-9-]+$/;
  if (!slugRegex.test(slug)) {
    throw new HttpsError(
      "invalid-argument",
      "Slug must contain only lowercase letters, numbers, and hyphens.",
    );
  }

  logger.info(`Checking slug availability: ${slug} for user: ${uid}`);

  // 4. Query Firestore for existing slug
  const database = getFirestore();
  const membersQuery = database
    .collection(MEMBERS_COLLECTION)
    .where("slug", "==", slug)
    .limit(1);

  const snapshot = await membersQuery.get();
  const isAvailable = snapshot.empty;

  logger.info(`Slug ${slug} availability: ${isAvailable}`);

  return { available: isAvailable };
}
