import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type CallableRequest } from "firebase-functions/v2/https";
import { MEMBERS_COLLECTION } from "../constants/index.js";
import { type MemberDocument } from "../types/member-document.js";
import { verifyAdmin } from "./verify-admin.js";

export interface ListMembersRequest {
  limit?: number;
  offset?: number;
}

export interface ListMembersResponse {
  members: MemberDocument[];
  total: number;
}

/**
 * Admin-only function to list all members with pagination.
 */
export async function handleListMembers(
  data: ListMembersRequest,
  context: CallableRequest,
): Promise<ListMembersResponse> {
  verifyAdmin(context);

  const { limit = 50, offset = 0 } = data;

  try {
    const firestore = getFirestore();
    const membersCollection = firestore.collection(MEMBERS_COLLECTION);

    // Get total count
    const countSnapshot = await membersCollection.count().get();
    const total = countSnapshot.data().count;

    // Get paginated members, ordered by creation date (newest first)
    const snapshot = await membersCollection
      .orderBy("createdAt", "desc")
      .limit(limit)
      .offset(offset)
      .get();

    const members: MemberDocument[] = [];
    for (const document of snapshot.docs) {
      members.push(document.data() as MemberDocument);
    }

    logger.log(`Admin ${context.auth?.uid} listed ${members.length} members`);

    return { members, total };
  } catch (error) {
    logger.error("Error listing members:", error);
    throw error;
  }
}
