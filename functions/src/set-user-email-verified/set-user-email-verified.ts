import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/v2/https";

export async function handleSetUserEmailVerified(request: CallableRequest) {
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
      "Email must be verified before updating verification status.",
    );
  }

  console.log(`Email verification confirmed for user: ${uid}`);

  const database = getFirestore();

  try {
    const profileData = await database.runTransaction(async transaction => {
      const importDocumentReference = database
        .collection("migrated_users_import")
        .doc(email);
      const memberDocumentReference = database.collection("members").doc(uid);

      const importDocument = await transaction.get(importDocumentReference);

      if (!importDocument.exists) {
        console.log(`No profile to claim for user: ${email}`);
        return; // No data to return
      }

      const data = importDocument.data();
      if (!data) {
        console.log(`No profile data for user: ${email}`);
        return;
      }

      transaction.set(memberDocumentReference, data, { merge: true });
      transaction.delete(importDocumentReference);

      return data;
    });

    if (profileData) {
      console.log(
        `Successfully claimed profile for user: ${email} (UID: ${uid})`,
      );

      // Update the auth displayName if name property exists in profile data.
      // This is done outside the transaction as it's an external operation.
      if (profileData.name && typeof profileData.name === "string") {
        const auth = getAuth();
        try {
          await auth.updateUser(uid, {
            displayName: profileData.name,
          });
          console.log(`Successfully updated displayName for user: ${email}`);
        } catch (authError) {
          console.error("Error updating auth displayName:", authError);
          // Don't throw here as the profile claim was successful
        }
      }
      return { status: "success", data: profileData };
    } else {
      // This handles the case where the transaction completed but there was no profile to claim.
      return { status: "no_profile_to_claim" };
    }
  } catch (error) {
    console.error("Error in profile claim transaction:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while claiming the profile.",
    );
  }
}
