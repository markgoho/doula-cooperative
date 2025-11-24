import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MESSAGES_COLLECTION, type MessageDocument } from "../collections/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface GetMessageRequest {
  id: string;
}

export interface GetMessageResponse extends MessageDocument {
  id: string;
}

/**
 * Admin-only function to get a specific message by ID.
 */
export async function handleGetMessage(
  data: GetMessageRequest,
  context: CallableRequest,
): Promise<GetMessageResponse> {
  verifyAdmin(context);

  const { id } = data;

  if (!id) {
    throw new HttpsError("invalid-argument", "Message ID is required.");
  }

  try {
    const firestore = getFirestore();
    const messageDocument = await firestore
      .collection(MESSAGES_COLLECTION)
      .doc(id)
      .get();

    if (!messageDocument.exists) {
      throw new HttpsError("not-found", `Message with ID ${id} not found.`);
    }

    logger.log(`Admin ${context.auth?.uid} retrieved message ${id}`);

    return {
      id: messageDocument.id,
      ...(messageDocument.data() as MessageDocument),
    };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error getting message:", error);
    throw new HttpsError("internal", "Failed to retrieve message.");
  }
}
