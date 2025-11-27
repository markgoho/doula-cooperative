import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import {
  MEMBERS_COLLECTION,
  type MemberDocument,
} from "../collections/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface UpdateMemberRequest {
  uid: string;
  updates: Partial<MemberDocument>;
}

export interface UpdateMemberResponse {
  success: boolean;
}

/**
 * Admin-only function to update a member document.
 * Does not allow updating certain protected fields.
 */
export async function handleUpdateMember(
  data: UpdateMemberRequest,
  context: CallableRequest,
): Promise<UpdateMemberResponse> {
  verifyAdmin(context);

  const { uid, updates } = data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required.");
  }

  if (Object.keys(updates).length === 0) {
    throw new HttpsError("invalid-argument", "No updates provided.");
  }

  // Prevent updating protected fields
  const protectedFields = ["uid", "createdAt"];
  for (const field of protectedFields) {
    if (field in updates) {
      throw new HttpsError(
        "invalid-argument",
        `Cannot update protected field: ${field}`,
      );
    }
  }

  // Convert date strings to Timestamps if provided
  const processedUpdates: Partial<MemberDocument> = { ...updates };
  if (
    updates.subscriptionStart &&
    typeof updates.subscriptionStart === "string"
  ) {
    processedUpdates.subscriptionStart = Timestamp.fromDate(
      new Date(updates.subscriptionStart),
    );
  }
  if (
    updates.membershipExpiresAt &&
    typeof updates.membershipExpiresAt === "string"
  ) {
    processedUpdates.membershipExpiresAt = Timestamp.fromDate(
      new Date(updates.membershipExpiresAt),
    );
  }

  try {
    const firestore = getFirestore();
    const memberReference = firestore.collection(MEMBERS_COLLECTION).doc(uid);

    // Verify member exists
    const memberDocument = await memberReference.get();
    if (!memberDocument.exists) {
      throw new HttpsError("not-found", `Member with UID ${uid} not found.`);
    }

    // Update the document
    await memberReference.update(processedUpdates);

    logger.log(
      `Admin ${context.auth?.uid} updated member ${uid}:`,
      Object.keys(processedUpdates),
    );

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error updating member:", error);
    throw new HttpsError("internal", "Failed to update member.");
  }
}
