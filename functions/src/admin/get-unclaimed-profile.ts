import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { IMPORT_COLLECTION } from "../constants/index.js";
import { type UnclaimedProfileDocument } from "./list-unclaimed-profiles.js";
import { verifyAdmin } from "./verify-admin.js";

export interface GetUnclaimedProfileRequest {
  email: string;
}

/**
 * Admin-only function to get a specific unclaimed profile by email.
 */
export async function handleGetUnclaimedProfile(
  data: GetUnclaimedProfileRequest,
  context: CallableRequest,
): Promise<UnclaimedProfileDocument> {
  verifyAdmin(context);

  const { email } = data;

  if (!email) {
    throw new HttpsError("invalid-argument", "Email is required.");
  }

  try {
    const firestore = getFirestore();
    const profileDocument = await firestore
      .collection(IMPORT_COLLECTION)
      .doc(email)
      .get();

    if (!profileDocument.exists) {
      throw new HttpsError(
        "not-found",
        `Unclaimed profile with email ${email} not found.`,
      );
    }

    const data = profileDocument.data() as UnclaimedProfileDocument;
    const profile: UnclaimedProfileDocument = {
      email: profileDocument.id,
      name: data.name,
      subscriptionStart: data.subscriptionStart,
      hasProfile: data.hasProfile,
      membershipActive: data.membershipActive,
      membershipExpiresAt: data.membershipExpiresAt,
    };

    logger.log(
      `Admin ${context.auth?.uid} retrieved unclaimed profile ${email}`,
    );

    return profile;
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error getting unclaimed profile:", error);
    throw new HttpsError("internal", "Failed to retrieve unclaimed profile.");
  }
}
