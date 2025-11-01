import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { IMPORT_COLLECTION } from "../constants";
import { type UnclaimedProfileDocument } from "./list-unclaimed-profiles";
import { verifyAdmin } from "./verify-admin";

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

    const data = profileDocument.data()!;
    const profile: UnclaimedProfileDocument = {
      email: profileDocument.id,
      name: data.name as string,
      subscriptionStart: data.subscriptionStart as FirebaseFirestore.Timestamp,
      hasProfile: data.hasProfile as boolean | undefined,
      membershipActive: data.membershipActive as boolean | undefined,
      membershipExpiresAt: data.membershipExpiresAt as FirebaseFirestore.Timestamp | undefined,
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
