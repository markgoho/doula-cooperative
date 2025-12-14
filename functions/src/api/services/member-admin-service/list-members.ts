import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../../collections/index.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import type { MemberDocument } from "../../../types/member-document.js";
import type { Logger } from "../../handler.js";

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/**
 * List all members with pagination.
 *
 * @param options - Pagination options (limit, offset, logger)
 * @returns Promise resolving to members array and total count
 */
export async function listMembers(options: {
  limit?: number;
  offset?: number;
  logger: Logger;
}): Promise<{
  members: MemberDocument[];
  total: number;
}> {
  const { limit = DEFAULT_LIMIT, offset = 0, logger } = options;

  // Cap limit to prevent performance issues
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  const firestore = getFirestore();
  const membersCollection = firestore.collection(MEMBERS_COLLECTION);

  const countSnapshot = await membersCollection.count().get();
  const countData = countSnapshot.data();

  if (typeof countData.count !== "number") {
    throw new TypeError(
      "Failed to retrieve member count. The count query returned invalid data.",
    );
  }

  const total = countData.count;

  const snapshot = await membersCollection
    .orderBy("createdAt", "desc")
    .limit(effectiveLimit)
    .offset(offset)
    .get();

  const members: MemberDocument[] = [];
  const invalidDocuments: string[] = [];

  for (const document of snapshot.docs) {
    const data = document.data();

    if (!data["email"] || !data["createdAt"]) {
      invalidDocuments.push(document.id);
      logger.error("Member document missing required fields", {
        errorId: ERROR_IDS.API_MEMBER_MISSING_FIELDS,
        documentId: document.id,
        hasEmail: Boolean(data["email"]),
        hasCreatedAt: Boolean(data["createdAt"]),
      });
      continue;
    }

    members.push({
      ...(data as MemberDocument),
      uid: document.id,
    });
  }

  if (invalidDocuments.length > 0) {
    logger.error("Found invalid member documents during list operation", {
      errorId: ERROR_IDS.API_MEMBER_INVALID_DATA,
      invalidCount: invalidDocuments.length,
      invalidDocumentIds: invalidDocuments,
      totalDocuments: snapshot.docs.length,
    });
  }

  return { members, total };
}
