import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type auth } from "firebase-functions/v1";
import { MEMBERS_COLLECTION } from "../constants";
import { type MemberDocument } from "../types/member-document";

export async function handleUserCreated(user: auth.UserRecord) {
  try {
    const { uid, email } = user;

    if (!email) {
      throw new Error("User email is required");
    }

    const firestore = getFirestore();

    // Create a new document in the members collection
    // Use the auth UID as the document ID
    const memberData: MemberDocument = {
      createdAt: Timestamp.now(),
      email,
      uid,
      membershipActive: false,
    };

    await firestore.collection(MEMBERS_COLLECTION).doc(uid).set(memberData);

    logger.log(`Created member document for user: ${user.uid}`);
  } catch (error: unknown) {
    logger.error("Error creating member document:", error);
    throw error;
  }
}
