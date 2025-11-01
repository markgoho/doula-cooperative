import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type CallableRequest } from "firebase-functions/v2/https";
import { IMPORT_COLLECTION } from "../constants";
import { verifyAdmin } from "./verify-admin";

export interface UnclaimedProfileDocument {
  email: string;
  name: string;
  subscriptionStart: FirebaseFirestore.Timestamp;
  hasProfile?: boolean;
  membershipActive?: boolean;
  membershipExpiresAt?: FirebaseFirestore.Timestamp;
}

export interface ListUnclaimedProfilesRequest {
  limit?: number;
  offset?: number;
}

export interface ListUnclaimedProfilesResponse {
  profiles: UnclaimedProfileDocument[];
  total: number;
}

/**
 * Admin-only function to list all unclaimed profiles from migrated_users_import collection.
 */
export async function handleListUnclaimedProfiles(
  data: ListUnclaimedProfilesRequest,
  context: CallableRequest,
): Promise<ListUnclaimedProfilesResponse> {
  verifyAdmin(context);

  const { limit = 50, offset = 0 } = data;

  try {
    const firestore = getFirestore();
    const importCollection = firestore.collection(IMPORT_COLLECTION);

    // Get total count
    const countSnapshot = await importCollection.count().get();
    const total = countSnapshot.data().count;

    // Get paginated profiles, ordered by email
    const snapshot = await importCollection
      .orderBy("__name__")
      .limit(limit)
      .offset(offset)
      .get();

    const profiles: UnclaimedProfileDocument[] = [];
    for (const document of snapshot.docs) {
      const data = document.data();
      profiles.push({
        email: document.id,
        name: data.name as string,
        subscriptionStart: data.subscriptionStart as FirebaseFirestore.Timestamp,
        hasProfile: data.hasProfile as boolean | undefined,
        membershipActive: data.membershipActive as boolean | undefined,
        membershipExpiresAt: data.membershipExpiresAt as FirebaseFirestore.Timestamp | undefined,
      });
    }

    logger.log(
      `Admin ${context.auth?.uid} listed ${profiles.length} unclaimed profiles`,
    );

    return { profiles, total };
  } catch (error) {
    logger.error("Error listing unclaimed profiles:", error);
    throw error;
  }
}
