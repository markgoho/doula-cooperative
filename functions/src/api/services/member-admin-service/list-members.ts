import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../../collections/index.js";
import type { MemberDocument } from "../../../types/member-document.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/**
 * List all members with pagination.
 *
 * @param options - Pagination options (limit, offset)
 * @returns Promise resolving to members array and total count
 */
export async function listMembers(options: {
  limit?: number;
  offset?: number;
}): Promise<{
  members: MemberDocument[];
  total: number;
}> {
  const { limit = DEFAULT_LIMIT, offset = 0 } = options;

  // Cap limit to prevent performance issues
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

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

  return { members, total };
}
