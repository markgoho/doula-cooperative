import { HttpsError } from "firebase-functions/v2/identity";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import type { AuthBlockingEvent } from "firebase-functions/v2/identity";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../collections/index.js";

const ADMIN_EMAIL = "webmaster@doulacooperative.com";

interface BeforeCreateResponse {
  customClaims?: Record<string, unknown>;
}

/**
 * Handles the beforeUserCreated blocking event.
 * Creates a member document in Firestore and sets admin claim if applicable.
 *
 * This is a blocking function - if it fails, user creation is blocked.
 *
 * @param event - The AuthBlockingEvent from Firebase
 * @returns Object with customClaims if user is admin
 * @throws HttpsError if email is missing or Firestore write fails
 */
export async function handleBeforeUserCreated(
  event: AuthBlockingEvent,
): Promise<BeforeCreateResponse> {
  const userData = event.data;

  if (!userData) {
    throw new HttpsError("invalid-argument", "User data is required");
  }

  const { uid, email } = userData;

  if (!email) {
    logger.error(`User ${uid} has no email, blocking creation`);
    throw new HttpsError("invalid-argument", "User email is required");
  }

  const firestore = getFirestore();
  const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(uid);

  // Check if document already exists (e.g., created by Stripe webhook)
  const existingDocument = await memberReference.get();

  if (existingDocument.exists) {
    logger.log(
      `Member document already exists for user: ${uid}, skipping creation`,
    );
  } else {
    const memberData: MemberDocument = {
      createdAt: Timestamp.now(),
      email,
      uid,
      membershipActive: false,
    };

    await memberReference.set(memberData);
    logger.log(`Created member document for user: ${uid}`);
  }

  // Set admin claim if email matches
  const isAdmin = email.toLowerCase() === ADMIN_EMAIL.toLowerCase();

  if (isAdmin) {
    logger.log(`Auto-granting admin claim to user: ${uid} (${email})`);
    return {
      customClaims: { admin: true },
    };
  }

  return {};
}
