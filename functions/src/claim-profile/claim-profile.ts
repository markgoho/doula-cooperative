import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import * as logger from "firebase-functions/logger";
import { type CallableRequest, HttpsError } from "firebase-functions/v2/https";

export async function handleClaimProfile(request: CallableRequest) {
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const { uid } = request.auth;
  const { email } = request.auth.token;

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "Authentication token did not contain an email address.",
    );
  }

  // Authoritatively check email verification via Admin SDK to avoid stale tokens
  const adminAuth = getAuth();
  const userRecord = await adminAuth.getUser(uid);
  if (!userRecord.emailVerified) {
    throw new HttpsError(
      "failed-precondition",
      "Email must be verified before claiming profile.",
    );
  }

  const database = getFirestore();

  try {
    const profileData = await database.runTransaction(async transaction => {
      const importDocumentReference = database
        .collection("migrated_users_import")
        .doc(email);
      const memberDocumentReference = database.collection("members").doc(uid);

      const importDocument = await transaction.get(importDocumentReference);

      if (!importDocument.exists) {
        return; // No data to return
      }

      const data = importDocument.data();
      if (!data) {
        return;
      }

      transaction.set(memberDocumentReference, data, { merge: true });
      transaction.delete(importDocumentReference);

      return data;
    });

    if (profileData) {
      // Update the auth displayName if name property exists in profile data.
      // This is done outside the transaction as it's an external operation.
      if (profileData.name && typeof profileData.name === "string") {
        const auth = getAuth();
        try {
          await auth.updateUser(uid, {
            displayName: profileData.name,
          });
        } catch (authError) {
          logger.error(
            "[claimProfile] Error updating auth displayName:",
            authError,
          );
          // Don't throw here as the profile claim was successful
        }
      }
      return { status: "success", data: profileData };
    } else {
      // This handles the case where the transaction completed but there was no profile to claim.
      return { status: "no_profile_to_claim" };
    }
  } catch (error) {
    logger.error("[claimProfile] Error in profile claim transaction:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while claiming the profile.",
    );
  }
}
