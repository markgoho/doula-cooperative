import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MEMBERS_COLLECTION } from "../constants/index.js";
import { type MemberDocument } from "../types/member-document.js";
import { verifyAdmin } from "./verify-admin.js";

export interface GetMemberRequest {
  uid: string;
}

export interface GetMemberResponse extends MemberDocument {
  isAdmin?: boolean;
}

/**
 * Admin-only function to get a specific member by UID.
 */
export async function handleGetMember(
  data: GetMemberRequest,
  context: CallableRequest,
): Promise<GetMemberResponse> {
  verifyAdmin(context);

  const { uid } = data;

  if (!uid) {
    throw new HttpsError("invalid-argument", "UID is required.");
  }

  try {
    const firestore = getFirestore();
    const auth = getAuth();

    const memberDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(uid)
      .get();

    if (!memberDocument.exists) {
      throw new HttpsError("not-found", `Member with UID ${uid} not found.`);
    }

    // Get user's custom claims to check admin status
    let isAdmin = false;
    try {
      const userRecord = await auth.getUser(uid);
      isAdmin = userRecord.customClaims?.["admin"] === true;
    } catch {
      // User might not exist in Auth (orphaned member document)
      // Default to non-admin
    }

    logger.log(`Admin ${context.auth?.uid} retrieved member ${uid}`);

    return {
      ...(memberDocument.data() as MemberDocument),
      isAdmin,
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error getting member:", error);
    throw new HttpsError("internal", "Failed to retrieve member.");
  }
}
