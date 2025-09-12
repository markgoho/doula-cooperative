import { getAuth } from "firebase-admin/auth";
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

  console.log(`Email verification confirmed for user: ${uid}`);
  return { success: true };
}
