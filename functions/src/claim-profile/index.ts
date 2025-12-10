import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { defineSecret } from "firebase-functions/params";
import {
  IMPORT_COLLECTION,
  MEMBERS_COLLECTION,
  type MemberDocument,
  type UnclaimedProfileDocumentData,
} from "../collections/index.js";
import { ERROR_IDS } from "../constants/error-ids.js";
import { addNewsletterSubscriber } from "../utils/mailerlite.js";

const mailerliteApiKey = defineSecret("MAILERLITE_API_KEY");

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
    .collection(IMPORT_COLLECTION)
    .doc(email);
  const importDocument = await importDocumentReference.get();

  if (!importDocument.exists) {
    // No pre-existing profile to claim. This is not an error,
    // as new users might sign up without a pre-existing profile.
    logger.log(`No profile to claim for user: ${email}`);
    return { status: "no_profile_to_claim" };
  }

  const profileData = importDocument.data() as
    | UnclaimedProfileDocumentData
    | undefined;

  // 4. Create the new profile in the 'members' collection.
  const memberDocumentReference = database
    .collection(MEMBERS_COLLECTION)
    .doc(uid);

  if (!profileData) {
    throw new HttpsError("not-found", "No profile data found for this user.");
  }

  const { subscriptionStart, createdAt, ...restOfProfileData } = profileData;

  // Calculate membership expiration date
  let membershipExpiresAt: Timestamp;
  try {
    membershipExpiresAt = calculateExpirationDate(subscriptionStart);
  } catch (error) {
    logger.error("Error calculating expiration date", {
      errorId: ERROR_IDS.CLAIM_PROFILE_EXPIRATION_CALC_ERROR,
      email,
      uid,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to calculate membership expiration date.",
    );
  }

  const memberUpdate: Partial<MemberDocument> = {
    ...restOfProfileData,
    subscriptionStart,
    membershipActive: true,
    membershipExpiresAt,
    // If legacy profile has createdAt, use it as profileCreatedAt
    ...(createdAt && { profileCreatedAt: createdAt }),
    // Subscribe to newsletter when claiming profile
    newsletterSubscribed: true,
    newsletterSubscribedAt: Timestamp.now(),
  };

  // 4. Write member document
  try {
    await memberDocumentReference.set(memberUpdate, { merge: true });
    logger.log(`Successfully claimed profile for user: ${email} (UID: ${uid})`);
  } catch (error) {
    logger.error("Error writing member document", {
      errorId: ERROR_IDS.CLAIM_PROFILE_FIRESTORE_WRITE_ERROR,
      email,
      uid,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to save profile data. Please try again.",
    );
  }

  // 4.5. Add to newsletter (non-critical - don't fail if this fails)
  if (mailerliteApiKey.value()) {
    try {
      await addNewsletterSubscriber({
        email,
        ...(profileData.name && { name: profileData.name }),
        subscriptionStart,
        membershipExpiresAt,
        ...(process.env["MAILERLITE_GROUP_ID"] && {
          groupId: process.env["MAILERLITE_GROUP_ID"],
        }),
        apiKey: mailerliteApiKey.value(),
      });
      logger.log(`Added subscriber to MailerLite newsletter: ${email}`);
    } catch (newsletterError) {
      // Log error but don't fail the claim operation - member is already subscribed in Firestore
      logger.error("Failed to add subscriber to MailerLite during profile claim", {
        errorId: ERROR_IDS.CLAIM_PROFILE_MAILERLITE_FAILED,
        email,
        uid,
        error: newsletterError,
        context: "Member is subscribed in Firestore but not in MailerLite",
      });
    }
  }

  // 5. Update the auth displayName if name property exists in profile data.
  if (profileData.name && typeof profileData.name === "string") {
    const auth = getAuth();
    try {
      await auth.updateUser(uid, {
        displayName: profileData.name,
      });
      logger.log(`Successfully updated displayName for user: ${email}`);
    } catch (authError) {
      // Log error but don't fail the whole operation - profile claim was successful
      logger.error("Error updating auth displayName", {
        errorId: ERROR_IDS.CLAIM_PROFILE_AUTH_UPDATE_FAILED,
        email,
        uid,
        error: authError,
      });
    }
  }

  // 6. Delete the document from the import collection.
  try {
    await importDocumentReference.delete();
    logger.log(`Successfully deleted import record for: ${email}`);
  } catch (deleteError) {
    // Log error but don't fail - profile claim was successful
    // Import cleanup is not critical but should be tracked for data hygiene
    logger.error("Failed to delete import record after successful claim", {
      errorId: ERROR_IDS.CLAIM_PROFILE_IMPORT_DELETE_FAILED,
      email,
      uid,
      error: deleteError,
    });
  }

  return { status: "success", data: profileData };
};
