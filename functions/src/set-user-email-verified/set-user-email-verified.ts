import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { CallableRequest, HttpsError } from "firebase-functions/v2/https";

export async function handleSetUserEmailVerified(request: CallableRequest) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const { uid } = request.auth;

  // Authoritatively check email verification via Admin SDK to avoid stale tokens
  const adminAuth = getAuth();
  const userRecord = await adminAuth.getUser(uid);
  if (!userRecord.emailVerified) {
    throw new HttpsError(
      "failed-precondition",
      "Email must be verified before updating verification status.",
    );
  }

  try {
    const firestore = getFirestore();
    const userDocumentReference = firestore.collection("members").doc(uid);
    await userDocumentReference.update({ emailVerified: true });
    return { success: true };
  } catch (error) {
    console.error("Error updating user email verification status:", error);
    throw new HttpsError(
      "internal",
      "Failed to update user email verification status.",
    );
  }
}
