import { getFirestore } from "firebase-admin/firestore";
import {
  IMPORT_COLLECTION,
  type UnclaimedProfileDocument,
} from "../../collections/migrated-users-import.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  toUnclaimedProfileResponse,
  type ListUnclaimedProfilesSuccessResponse,
} from "../schemas/unclaimed-profile-schemas.js";

interface ListUnclaimedProfilesOptions {
  limit?: number;
  offset?: number;
  logger: Logger;
}

export async function listUnclaimedProfiles({
  limit = 50,
  offset = 0,
  logger,
}: ListUnclaimedProfilesOptions): Promise<ListUnclaimedProfilesSuccessResponse> {
  try {
    const firestore = getFirestore();
    const importCollection = firestore.collection(IMPORT_COLLECTION);

    // Get total count
    const countSnapshot = await importCollection.count().get();
    const total = countSnapshot.data().count;

    // Get paginated profiles, ordered by email (document ID)
    const snapshot = await importCollection
      .orderBy("__name__")
      .limit(limit)
      .offset(offset)
      .get();

    const profiles = snapshot.docs.map((document) => {
      const documentData = document.data() as Record<string, unknown>;
      const profile: UnclaimedProfileDocument = {
        ...(documentData as Omit<UnclaimedProfileDocument, "email">),
        email: document.id,
      };
      return toUnclaimedProfileResponse(profile);
    });

    return { profiles, total };
  } catch (error) {
    logger.error("Failed to list unclaimed profiles from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      limit,
      offset,
    });
    throw error;
  }
}
