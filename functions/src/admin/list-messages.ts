import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { type CallableRequest } from "firebase-functions/v2/https";
import {
  MESSAGES_COLLECTION,
  type MessageDocument,
} from "../collections/index.js";
import { verifyAdmin } from "./verify-admin.js";

export type MessageStatus = "all" | "pending" | "processed";

export interface ListMessagesRequest {
  limit?: number;
  offset?: number;
  status?: MessageStatus;
}

export interface MessageWithId extends MessageDocument {
  id: string;
}

export interface ListMessagesResponse {
  messages: MessageWithId[];
  total: number;
  pendingCount: number;
  processedCount: number;
}

const MAX_LIMIT = 100;
const DEFAULT_LIMIT = 50;

/**
 * Admin-only function to list all messages with pagination and filtering.
 */
export async function handleListMessages(
  data: ListMessagesRequest,
  context: CallableRequest,
): Promise<ListMessagesResponse> {
  verifyAdmin(context);

  const { limit = DEFAULT_LIMIT, offset = 0, status = "all" } = data;

  // Cap limit to prevent performance issues
  const effectiveLimit = Math.min(Math.max(1, limit), MAX_LIMIT);

  try {
    const firestore = getFirestore();
    const messagesCollection = firestore.collection(MESSAGES_COLLECTION);

    // Get total count
    const totalSnapshot = await messagesCollection.count().get();
    const total = totalSnapshot.data().count;

    // Get pending count
    const pendingSnapshot = await messagesCollection
      .where("sent", "==", false)
      .count()
      .get();
    const pendingCount = pendingSnapshot.data().count;

    // Get processed count
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
    const snapshot = await query.limit(effectiveLimit).offset(offset).get();

    const messages: MessageWithId[] = [];
    for (const document of snapshot.docs) {
      messages.push({
        id: document.id,
        ...(document.data() as MessageDocument),
      });
    }

    logger.log(
      `Admin ${context.auth?.uid} listed ${messages.length} messages (status: ${status})`,
    );

    return { messages, total, pendingCount, processedCount };
  } catch (error) {
    logger.error("Error listing messages:", error);
    throw error;
  }
}
