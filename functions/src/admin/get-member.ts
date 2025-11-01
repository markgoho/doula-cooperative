import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MEMBERS_COLLECTION } from "../constants";
import { type MemberDocument } from "../types/member-document";
import { verifyAdmin } from "./verify-admin";

export interface GetMemberRequest {
  uid: string;
}

/**
 * Admin-only function to get a specific member by UID.
 */
export async function handleGetMember(
  data: GetMemberRequest,
  context: CallableRequest,
): Promise<MemberDocument> {
  verifyAdmin(context);

  const { uid } = data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required.");
  }

  try {
    const firestore = getFirestore();
    const memberDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(uid)
      .get();

    if (!memberDocument.exists) {
      throw new HttpsError("not-found", `Member with UID ${uid} not found.`);
    }

    logger.log(`Admin ${context.auth?.uid} retrieved member ${uid}`);

    return memberDocument.data() as MemberDocument;
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error getting member:", error);
    throw new HttpsError("internal", "Failed to retrieve member.");
  }
}
