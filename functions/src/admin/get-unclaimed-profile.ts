import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { IMPORT_COLLECTION, type UnclaimedProfileDocument } from "../collections/index.js";
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

    const documentData = profileDocument.data();
    if (!documentData) {
      throw new HttpsError(
        "not-found",
        `Unclaimed profile with email ${email} has no data.`,
      );
    }

    const profile: UnclaimedProfileDocument = {
      email: profileDocument.id,
      name: documentData["name"] as string,
      subscriptionStart: documentData[
        "subscriptionStart"
      ] as FirebaseFirestore.Timestamp,
      ...(documentData["slug"] !== undefined && {
        slug: documentData["slug"] as string,
      }),
      ...(documentData["membershipActive"] !== undefined && {
        membershipActive: documentData["membershipActive"] as boolean,
      }),
      ...(documentData["membershipExpiresAt"] !== undefined && {
        membershipExpiresAt: documentData[
          "membershipExpiresAt"
        ] as FirebaseFirestore.Timestamp,
      }),
      ...(documentData["invitationEmailStatus"] !== undefined && {
        invitationEmailStatus: documentData["invitationEmailStatus"] as
          | "sent"
          | "failed"
          | "pending",
      }),
      ...(documentData["invitationEmailSentAt"] !== undefined && {
        invitationEmailSentAt: documentData[
          "invitationEmailSentAt"
        ] as FirebaseFirestore.Timestamp,
      }),
      ...(documentData["invitationEmailError"] !== undefined && {
        invitationEmailError: documentData["invitationEmailError"] as string,
      }),
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
