import {
  PROFILES_COLLECTION,
  type ProfileDocument,
} from "@doula-coop/functions-shared/collections/index.js";
import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { HttpError } from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";

export interface UnlinkedProfile {
  slug: string;
  title: string;
  email: string;
  createdAt: string;
}

export interface ListUnlinkedProfilesResult {
  profiles: UnlinkedProfile[];
}

/**
 * List all profiles that are not linked to a member account.
 * These are profiles where the `ownerUid` field does not exist.
 *
 * Since the profiles collection is small (doula cooperative members),
 * we fetch all profiles and filter client-side for those without an ownerUid.
 *
 * @returns Array of unlinked profiles with slug, title, email, and createdAt
 */
export async function listUnlinkedProfiles(): Promise<ListUnlinkedProfilesResult> {
  try {
    const firestore = getFirestore();
    const profilesReference = firestore.collection(PROFILES_COLLECTION);
    const snapshot = await profilesReference.get();

    const profiles: UnlinkedProfile[] = [];

    for (const document of snapshot.docs) {
      const data = document.data() as ProfileDocument;

      // Skip profiles that already have an owner
      if (data.ownerUid !== undefined) {
        continue;
      }

      profiles.push({
        slug: document.id,
        title: data.title,
        email: data.contact?.email ?? "",
        createdAt: data.createdAt,
      });
    }

    logger.info("Listed unlinked profiles", { count: profiles.length });

    return { profiles };
  } catch (error) {
    if (error instanceof HttpError) {
      throw error;
    }

    logger.error("Failed to list unlinked profiles", {
      errorId: ERROR_IDS.API_ADMIN_LIST_UNLINKED_PROFILES_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw new HttpError("Failed to list unlinked profiles", 500);
  }
}
