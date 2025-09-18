import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MemberDocument } from "../types/member-document";

interface ProfileData {
  name: string;
  subscriptionStart: Timestamp;
}

function calculateExpirationDate(subscriptionStart: Timestamp): Timestamp {
  const startDate = subscriptionStart.toDate();
  const monthIndex = startDate.getMonth(); // 0-11

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let expirationYear = currentYear;

  // If the renewal month has already passed this year, or we are in the renewal month,
  // the next renewal is next year.
  if (
    currentMonth > monthIndex ||
    (currentMonth === monthIndex && now.getDate() > 1)
  ) {
    expirationYear += 1;
  }

  // Set the expiration to the last day of the subscription month in the expiration year.
  const expirationDate = new Date(expirationYear, monthIndex + 1, 0);
  return Timestamp.fromDate(expirationDate);
}

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
    logger.log(`No profile to claim for user: ${email}`);
    return { status: "no_profile_to_claim" };
  }

  const profileData = importDocument.data() as ProfileData;

  // 4. Create the new profile in the 'members' collection.
  const memberDocumentReference = database.collection("members").doc(uid);

  try {
    const { subscriptionStart, ...restOfProfileData } = profileData;
    const membershipExpiresAt = calculateExpirationDate(subscriptionStart);

    const memberUpdate: Partial<MemberDocument> = {
      ...restOfProfileData,
      membershipActive: true,
      membershipExpiresAt,
    };

    await memberDocumentReference.set(memberUpdate, { merge: true });
    logger.log(`Successfully claimed profile for user: ${email} (UID: ${uid})`);

    // 5. Update the auth displayName if name property exists in profile data.
    if (profileData.name && typeof profileData.name === "string") {
      const auth = getAuth();
      try {
        await auth.updateUser(uid, {
          displayName: profileData.name,
        });
        logger.log(`Successfully updated displayName for user: ${email}`);
      } catch (authError) {
        logger.error("Error updating auth displayName:", authError);
        // Don't throw here as the profile claim was successful
      }
    }

    // 6. Delete the document from the import collection.
    await importDocumentReference.delete();
    logger.log(`Successfully deleted import record for: ${email}`);

    return { status: "success", data: profileData };
  } catch (error) {
    logger.error("Error claiming profile:", error);
    throw new HttpsError(
      "internal",
      "An error occurred while claiming the profile.",
    );
  }
};
