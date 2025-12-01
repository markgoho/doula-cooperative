import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import { MEMBERS_COLLECTION, type MemberDocument } from "../collections/index.js";

interface SetProfileSlugRequest {
  slug: string;
}

export async function handleSetProfileSlug(
  request: CallableRequest<SetProfileSlugRequest>,
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

  logger.info(`Setting slug: ${slug} for user: ${uid}`);

  const database = getFirestore();

  // 4. Get the member document
  const memberReference = database.collection(MEMBERS_COLLECTION).doc(uid);
  const memberDocument = await memberReference.get();

  if (!memberDocument.exists) {
    throw new HttpsError(
      "not-found",
      "No member document found for this user.",
    );
  }

  const memberData = memberDocument.data() as MemberDocument | undefined;
  if (!memberData) {
    throw new HttpsError("not-found", "Member document data is empty.");
  }

  // 5. Check if user has an active membership
  if (!memberData.membershipActive) {
    throw new HttpsError(
      "failed-precondition",
      "User does not have an active membership.",
    );
  }

  // 6. Check if user already has a slug (prevent overwriting)
  if (memberData.slug) {
    throw new HttpsError(
      "failed-precondition",
      "User already has a profile slug. Contact support to change it.",
    );
  }

  // 7. Check if slug is already taken
  const membersQuery = database
    .collection(MEMBERS_COLLECTION)
    .where("slug", "==", slug)
    .limit(1);

  const snapshot = await membersQuery.get();
  if (!snapshot.empty) {
    throw new HttpsError(
      "already-exists",
      "This slug is already taken. Please choose another.",
    );
  }

  // 8. Update the member document with the slug
  await memberReference.update({ slug });

  logger.info(`Successfully set slug: ${slug} for user: ${uid}`);

  return { success: true, slug };
}
