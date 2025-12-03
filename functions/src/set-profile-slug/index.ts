import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/https";
import * as logger from "firebase-functions/logger";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../collections/index.js";
import { ERROR_IDS } from "../constants/error-ids.js";

interface SetProfileSlugRequest {
  slug: string;
}

export async function handleSetProfileSlug(
  request: CallableRequest<SetProfileSlugRequest>,
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

  logger.info(`Setting slug: ${slug} for user: ${uid}`);

  const database = getFirestore();
  const memberReference = database.collection(MEMBERS_COLLECTION).doc(uid);

  try {
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

    if (!memberData.membershipActive) {
      throw new HttpsError(
        "failed-precondition",
        "User does not have an active membership.",
      );
    }

    // Slugs are immutable after creation to preserve URL consistency and prevent broken links
    // to published profiles. Changes require admin intervention to ensure proper redirects.
    if (memberData.slug) {
      throw new HttpsError(
        "failed-precondition",
        "User already has a profile slug. Contact support to change it.",
      );
    }
  } catch (error: unknown) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to read member document in setProfileSlug", {
      errorId: ERROR_IDS.SET_SLUG_FIRESTORE_READ_ERROR,
      uid,
      slug,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to retrieve member information. Please try again.",
    );
  }

  // Use transaction to atomically check slug availability and update member document
  // This prevents race conditions where two users could claim the same slug simultaneously
  try {
    await database.runTransaction(async (transaction) => {
      const membersQuery = database
        .collection(MEMBERS_COLLECTION)
        .where("slug", "==", slug)
        .limit(1);

      const snapshot = await transaction.get(membersQuery);

      if (!snapshot.empty) {
        throw new HttpsError(
          "already-exists",
          "This slug is already taken. Please choose another.",
        );
      }

      transaction.update(memberReference, { slug });
    });

    logger.info(`Successfully set slug: ${slug} for user: ${uid}`);
    return { success: true, slug };
  } catch (error: unknown) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Failed to update member document with slug", {
      errorId: ERROR_IDS.SET_SLUG_FIRESTORE_UPDATE_FAILED,
      uid,
      slug,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to save your profile slug. Please try again.",
    );
  }
}
