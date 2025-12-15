import { getFirestore } from "firebase-admin/firestore";
import {
  MESSAGES_COLLECTION,
  type MessageDocument,
} from "../../collections/messages.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  toMessageResponse,
  type ListMessagesResponse,
} from "../schemas/message-schemas.js";

export type MessageStatus = "pending" | "processed" | "all";

interface ListMessagesOptions {
  limit?: number;
  offset?: number;
  status?: MessageStatus;
  logger: Logger;
}

export async function listMessages({
  limit = 50,
  offset = 0,
  status = "all",
  logger,
}: ListMessagesOptions): Promise<ListMessagesResponse> {
  try {
    const firestore = getFirestore();
    const messagesCollection = firestore.collection(MESSAGES_COLLECTION);

    // Get counts
    const totalSnapshot = await messagesCollection.count().get();
    const total = totalSnapshot.data().count;

    const pendingSnapshot = await messagesCollection
      .where("sent", "==", false)
      .count()
      .get();
    const pendingCount = pendingSnapshot.data().count;
    const processedCount = total - pendingCount;

    // Build query based on status filter
    let query;
    if (status === "pending") {
      query = messagesCollection
        .where("sent", "==", false)
        .orderBy("submitted", "desc");
    } else if (status === "processed") {
      query = messagesCollection
        .where("sent", "==", true)
        .orderBy("submitted", "desc");
    } else {
      query = messagesCollection.orderBy("submitted", "desc");
    }

    // Apply pagination
    const snapshot = await query.limit(limit).offset(offset).get();

    const messages = snapshot.docs.map((document) =>
      toMessageResponse(document.id, document.data() as MessageDocument),
    );

    return { messages, total, pendingCount, processedCount };
  } catch (error) {
    logger.error("Failed to list messages from Firestore", {
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
