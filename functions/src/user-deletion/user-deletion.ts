import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type auth } from "firebase-functions/v1";

export async function handleUserDeleted(user: auth.UserRecord) {
  try {
    const { uid } = user;
    const firestore = getFirestore();

    // Delete the member document that matches the auth UID
    await firestore.collection("members").doc(uid).delete();

    logger.log(`Deleted member document for user: ${user.uid}`);
  } catch (error: unknown) {
    logger.error("Error deleting member document:", error);
    throw error;
  }
}
