import { getFirestore } from "firebase-admin/firestore";
import type { CallableRequest } from "firebase-functions/v2/https";
import { HttpsError } from "firebase-functions/v2/https";

export const handleClaimProfile = async (
  _data: unknown,
  context: CallableRequest,
) => {
  // 1. Ensure the user is authenticated.
  if (!context.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  // 2. Ensure the user's email is verified.
  if (!context.auth.token.email_verified) {
    throw new HttpsError(
      "failed-precondition",
      "The user must have a verified email to claim a profile.",
    );
  }

  const { uid } = context.auth;
  const { email } = context.auth.token;

  if (!email) {
    throw new HttpsError(
      "invalid-argument",
      "Authentication token did not contain an email address.",
    );
  }

  const database = getFirestore();

  // 3. Look for a matching document in the import collection.
  const importDocumentReference = database
    .collection("migrated_users_import")
    .doc(email);
  const importDocument = await importDocumentReference.get();

  if (!importDocument.exists) {
    // No pre-existing profile to claim. This is not an error,
    // as new users might sign up without a pre-existing profile.
    console.log(`No profile to claim for user: ${email}`);
    return { status: "no_profile_to_claim" };
  }

  const profileData = importDocument.data();

  // 4. Create the new profile in the 'members' collection.
  const memberDocumentReference = database.collection("members").doc(uid);

  try {
    if (profileData) {
      // Use { merge: true } to update the existing document instead of overwriting it.
      await memberDocumentReference.set(profileData, { merge: true });
      console.log(
        `Successfully claimed profile for user: ${email} (UID: ${uid})`,
      );

      // 5. Delete the document from the import collection.
      await importDocumentReference.delete();
      console.log(`Successfully deleted import record for: ${email}`);

      return { status: "success", data: profileData };
    }
    return { status: "no_profile_data" };
  } catch (error) {
    console.error("Error claiming profile:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while claiming the profile.",
    );
  }
};
