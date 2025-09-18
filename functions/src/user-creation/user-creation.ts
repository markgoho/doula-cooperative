import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type auth } from "firebase-functions/v1";

export async function handleUserCreated(user: auth.UserRecord) {
  try {
    const { uid, email } = user;
    const firestore = getFirestore();

    // Create a new document in the members collection
    // Use the auth UID as the document ID
    await firestore.collection("members").doc(uid).set({
      createdAt: Timestamp.now(),
      email,
      uid,
      membershipActive: false,
    });

    logger.log(`Created member document for user: ${user.uid}`);
  } catch (error: unknown) {
    logger.error("Error creating member document:", error);
    throw error;
  }
}
