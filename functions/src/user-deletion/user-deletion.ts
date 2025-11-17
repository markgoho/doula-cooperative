import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type auth } from "firebase-functions/v1";
import { MEMBERS_COLLECTION } from "../collections/index.js";

export async function handleUserDeleted(user: auth.UserRecord) {
  try {
    const { uid } = user;
    const firestore = getFirestore();

    // Delete the member document that matches the auth UID
    await firestore.collection(MEMBERS_COLLECTION).doc(uid).delete();

    logger.log(`Deleted member document for user: ${user.uid}`);
  } catch (error: unknown) {
    logger.error("Error deleting member document:", error);
    throw error;
  }
}
