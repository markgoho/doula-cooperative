import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type CallableRequest } from "firebase-functions/v2/https";
import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "../collections/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface ListMatchRequestsRequest {
  limit?: number;
  offset?: number;
  status?: "pending" | "processed" | "all";
}

export interface MatchRequestWithId extends MatchRequestDocument {
  id: string;
}

export interface ListMatchRequestsResponse {
  requests: MatchRequestWithId[];
  total: number;
  pendingCount: number;
  processedCount: number;
}

/**
 * Admin-only function to list all match requests with pagination and filtering.
 */
export async function handleListMatchRequests(
  data: ListMatchRequestsRequest,
  context: CallableRequest,
): Promise<ListMatchRequestsResponse> {
  verifyAdmin(context);

  const { limit = 50, offset = 0, status = "all" } = data;

  try {
    const firestore = getFirestore();
    const matchRequestsCollection = firestore.collection(
      MATCH_REQUESTS_COLLECTION,
    );

    // Get total count
    const totalSnapshot = await matchRequestsCollection.count().get();
    const total = totalSnapshot.data().count;

    // Get pending count
    const pendingSnapshot = await matchRequestsCollection
      .where("sent", "==", false)
      .count()
      .get();
    const pendingCount = pendingSnapshot.data().count;

    // Get processed count
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

    const requests: MatchRequestWithId[] = [];
    for (const document of snapshot.docs) {
      requests.push({
        id: document.id,
        ...(document.data() as MatchRequestDocument),
      });
    }

    logger.log(
      `Admin ${context.auth?.uid} listed ${requests.length} match requests (status: ${status})`,
    );

    return { requests, total, pendingCount, processedCount };
  } catch (error) {
    logger.error("Error listing match requests:", error);
    throw error;
  }
}
