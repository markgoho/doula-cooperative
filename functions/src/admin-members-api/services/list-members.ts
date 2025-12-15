import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION } from "../../collections/index.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { MemberDocument } from "../../types/member-document.js";

/**
 * List all members.
 *
 * @param options - Logger for error reporting
 * @returns Promise resolving to members array, total count, and optional warning
 */
export async function listMembers(options: { logger: Logger }): Promise<{
  members: MemberDocument[];
  total: number;
  warning?: string;
}> {
  const { logger } = options;

  const firestore = getFirestore();
  const membersCollection = firestore.collection(MEMBERS_COLLECTION);

  const snapshot = await membersCollection.orderBy("createdAt", "desc").get();

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

  const total = members.length;

  if (invalidDocuments.length > 0) {
    logger.error(
      "CRITICAL: Found invalid member documents during list operation",
      {
        errorId: ERROR_IDS.API_MEMBER_INVALID_DATA,
        severity: "CRITICAL",
        invalidCount: invalidDocuments.length,
        invalidDocumentIds: invalidDocuments,
        totalDocuments: snapshot.docs.length,
        action: "Database integrity issue - admin should investigate",
      },
    );

    return {
      members,
      total,
      warning: `Warning: ${invalidDocuments.length} member(s) have invalid data and were excluded. Contact support to investigate.`,
    };
  }

  return { members, total };
}
