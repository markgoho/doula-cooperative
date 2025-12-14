import { getFirestore } from "firebase-admin/firestore";
import { MEMBERS_COLLECTION, type MemberDocument } from "../../../collections/index.js";
import { ERROR_IDS } from "../../../constants/error-ids.js";
import type { Logger } from "../../../shared-api/types/logger.js";
import type { MemberInfo } from "./types.js";

/**
 * Find a member by their profile slug.
 *
 * @param slug - The member's profile slug
 * @param logger - Logger instance for error tracking
 * @returns Member information if found, undefined otherwise
 */
export async function findMemberBySlug({
  slug,
  logger,
}: {
  slug: string;
  logger: Logger;
}): Promise<MemberInfo | undefined> {
  const membersReference = getFirestore().collection(MEMBERS_COLLECTION);
  const memberQuery = membersReference.where("slug", "==", slug).limit(1);

  let snapshot;
  try {
    snapshot = await memberQuery.get();
  } catch (error) {
    logger.error("Failed to query member by slug", {
      errorId: ERROR_IDS.PROFILE_DEPLOY_WEBHOOK_MEMBER_LOOKUP_FAILED,
      slug,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      severity: "CRITICAL",
      actionRequired: "Check Firestore permissions and database connectivity",
    });
    return undefined;
  }

  if (snapshot.empty || !snapshot.docs[0]) {
    return undefined;
  }

  const memberData = snapshot.docs[0].data() as MemberDocument;

  if (!memberData.email) {
    return undefined;
  }

  return {
    uid: memberData.uid,
    email: memberData.email,
    name: memberData.name,
    slug,
  };
}
