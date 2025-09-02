import { getFirestore } from "firebase-admin/firestore";
import { type auth } from "firebase-functions/v1";

export async function handleUserDeleted(user: auth.UserRecord) {
  try {
    const { uid } = user;
    const firestore = getFirestore();

    // Delete the member document that matches the auth UID
    await firestore.collection("members").doc(uid).delete();

    console.log(`Deleted member document for user: ${user.uid}`);
  } catch (error: unknown) {
    console.error("Error deleting member document:", error);
    throw error;
  }
}
