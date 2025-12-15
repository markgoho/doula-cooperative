import { getFirestore } from "firebase-admin/firestore";
import {
  MESSAGES_COLLECTION,
  type MessageDocument,
} from "../../collections/messages.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  toMessageResponse,
  type MessageResponse,
} from "../schemas/message-schemas.js";

export async function getMessage(options: {
  messageId: string;
  logger: Logger;
}): Promise<MessageResponse> {
  const { messageId, logger } = options;

  try {
    const firestore = getFirestore();
    const documentReference = firestore
      .collection(MESSAGES_COLLECTION)
      .doc(messageId);
    const document = await documentReference.get();

    if (!document.exists) {
      logger.warn("Message not found", {
        errorId: ERROR_IDS.API_MESSAGE_NOT_FOUND,
        messageId,
      });
      throw new NotFoundError(`Message with ID ${messageId} not found`);
    }

    return toMessageResponse(document.id, document.data() as MessageDocument);
  } catch (error) {
    // If it's already a NotFoundError, re-throw it
    if (error instanceof NotFoundError) {
      throw error;
    }

    // Log unexpected Firestore errors
    logger.error("Failed to read message from Firestore", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      messageId,
    });
    throw error;
  }
}
