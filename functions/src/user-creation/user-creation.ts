import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type auth } from "firebase-functions/v1";
import { MEMBERS_COLLECTION } from "../constants/index.js";
import { type MemberDocument } from "../types/member-document.js";

export async function handleUserCreated(user: auth.UserRecord) {
  try {
    const { uid, email } = user;

    if (!email) {
      throw new Error("User email is required");
    }

    const firestore = getFirestore();
    const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(uid);

    // Check if document already exists (e.g., created by Stripe webhook)
    const existingDocument = await memberReference.get();

    if (existingDocument.exists) {
      logger.log(
        `Member document already exists for user: ${user.uid}, skipping creation`,
      );
      return;
    }

    // Create a new document in the members collection
    // Use the auth UID as the document ID
    const memberData: MemberDocument = {
      createdAt: Timestamp.now(),
      email,
      uid,
      membershipActive: false,
    };

    await memberReference.set(memberData);

    logger.log(`Created member document for user: ${user.uid}`);
  } catch (error: unknown) {
    logger.error("Error creating member document:", error);
    throw error;
  }
}
