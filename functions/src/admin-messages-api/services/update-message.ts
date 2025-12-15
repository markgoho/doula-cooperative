import { getFirestore } from "firebase-admin/firestore";
import { MESSAGES_COLLECTION } from "../../collections/messages.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { NotFoundError } from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";

export async function updateMessage(options: {
  messageId: string;
  sent: boolean;
  logger: Logger;
}): Promise<{ success: true }> {
  const { messageId, sent, logger } = options;

  const firestore = getFirestore();
  const documentReference = firestore
    .collection(MESSAGES_COLLECTION)
    .doc(messageId);

  // Verify document exists
  const document = await documentReference.get();
  if (!document.exists) {
    logger.warn("Cannot update - message not found", {
      errorId: ERROR_IDS.API_MESSAGE_NOT_FOUND,
      messageId,
    });
    throw new NotFoundError(`Message with ID ${messageId} not found`);
  }

  // Update the sent status
  await documentReference.update({ sent });

  logger.info("Message status updated", {
    messageId,
    sent,
    status: sent ? "processed" : "pending",
  });

  return { success: true };
}
