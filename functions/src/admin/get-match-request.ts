import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MATCH_REQUESTS_COLLECTION, type MatchRequestDocument } from "../collections/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface GetMatchRequestRequest {
  id: string;
}

export interface GetMatchRequestResponse extends MatchRequestDocument {
  id: string;
}

/**
 * Admin-only function to get a specific match request by ID.
 */
export async function handleGetMatchRequest(
  data: GetMatchRequestRequest,
  context: CallableRequest,
): Promise<GetMatchRequestResponse> {
  verifyAdmin(context);

  const { id } = data;

  if (!id) {
    throw new HttpsError("invalid-argument", "Match request ID is required.");
  }

  try {
    const firestore = getFirestore();
    const matchRequestDocument = await firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .doc(id)
      .get();

    if (!matchRequestDocument.exists) {
      throw new HttpsError("not-found", `Match request with ID ${id} not found.`);
    }

    logger.log(`Admin ${context.auth?.uid} retrieved match request ${id}`);

    return {
      id: matchRequestDocument.id,
      ...(matchRequestDocument.data() as MatchRequestDocument),
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error getting match request:", error);
    throw new HttpsError("internal", "Failed to retrieve match request.");
  }
}
