import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type CallableRequest } from "firebase-functions/v2/https";
import { MEMBERS_COLLECTION, type MemberDocument } from "../collections/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface ListMembersRequest {
  limit?: number;
  offset?: number;
}

export interface ListMembersResponse {
  members: MemberDocument[];
  total: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/**
 * Admin-only function to list all members with pagination.
 */
export async function handleListMembers(
  data: ListMembersRequest,
  context: CallableRequest,
): Promise<ListMembersResponse> {
  verifyAdmin(context);

  const { limit = DEFAULT_LIMIT, offset = 0 } = data;

  // Cap limit to prevent performance issues
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  try {
    const firestore = getFirestore();
    const membersCollection = firestore.collection(MEMBERS_COLLECTION);

    // Get total count
    const countSnapshot = await membersCollection.count().get();
    const total = countSnapshot.data().count;

    // Get paginated members, ordered by creation date (newest first)
    const snapshot = await membersCollection
      .orderBy("createdAt", "desc")
      .limit(effectiveLimit)
      .offset(offset)
      .get();

    const members: MemberDocument[] = [];
    for (const document of snapshot.docs) {
      const data = document.data() as MemberDocument;
      // Ensure uid matches document ID (uid is the document ID in members collection)
      members.push({
        ...data,
        uid: document.id,
      });
    }

    logger.log(`Admin ${context.auth?.uid} listed ${members.length} members`);

    return { members, total };
  } catch (error) {
    logger.error("Error listing members:", error);
    throw error;
  }
}
