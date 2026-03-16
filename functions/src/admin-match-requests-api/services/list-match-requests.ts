import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "@doula-coop/functions-shared/collections/match-requests.js";
import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { getFirestore } from "firebase-admin/firestore";
import {
  toMatchRequestResponse,
  type ListMatchRequestsResponse,
} from "../schemas/match-request-schemas.js";

export type MatchRequestStatus = "pending" | "processed" | "all";

interface ListMatchRequestsOptions {
  limit?: number;
  offset?: number;
  status?: MatchRequestStatus;
  logger: Logger;
}

export async function listMatchRequests({
  limit = 50,
  offset = 0,
  status = "all",
  logger,
}: ListMatchRequestsOptions): Promise<ListMatchRequestsResponse> {
  try {
    const firestore = getFirestore();
    const matchRequestsCollection = firestore.collection(
      MATCH_REQUESTS_COLLECTION,
    );

    // Get counts
    const totalSnapshot = await matchRequestsCollection.count().get();
    const total = totalSnapshot.data().count;

    const pendingSnapshot = await matchRequestsCollection
      .where("sent", "==", false)
      .count()
      .get();
    const pendingCount = pendingSnapshot.data().count;
    const processedCount = total - pendingCount;

    // Build query based on status filter
    let query;
    if (status === "pending") {
      query = matchRequestsCollection
        .where("sent", "==", false)
        .orderBy("submitted", "desc");
    } else if (status === "processed") {
      query = matchRequestsCollection
        .where("sent", "==", true)
        .orderBy("submitted", "desc");
    } else {
      query = matchRequestsCollection.orderBy("submitted", "desc");
    }

    // Apply pagination
    const snapshot = await query.limit(limit).offset(offset).get();

    const requests = snapshot.docs.map(document =>
      toMatchRequestResponse(
        document.id,
        document.data() as MatchRequestDocument,
      ),
    );

    return { requests, total, pendingCount, processedCount };
  } catch (error) {
    logger.error("Failed to list match requests from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      limit,
      offset,
      status,
    });
    throw error;
  }
}
