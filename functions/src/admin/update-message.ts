import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MESSAGES_COLLECTION } from "../collections/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface UpdateMessageRequest {
  id: string;
  sent: boolean;
}

export interface UpdateMessageResponse {
  success: boolean;
}

/**
 * Admin-only function to update a message's status.
 * Currently only allows updating the 'sent' field.
 */
export async function handleUpdateMessage(
  data: UpdateMessageRequest,
  context: CallableRequest,
): Promise<UpdateMessageResponse> {
  verifyAdmin(context);

  const { id, sent } = data;

  if (!id) {
    throw new HttpsError("invalid-argument", "Message ID is required.");
  }

  if (typeof sent !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "Status (sent) must be a boolean.",
    );
  }

  try {
    const firestore = getFirestore();
    const messageReference = firestore.collection(MESSAGES_COLLECTION).doc(id);

    // Verify message exists
    const messageDocument = await messageReference.get();
    if (!messageDocument.exists) {
      throw new HttpsError("not-found", `Message with ID ${id} not found.`);
    }

    // Update the sent status
    await messageReference.update({ sent });

    logger.log(
      `Admin ${context.auth?.uid} updated message ${id} status to ${sent ? "processed" : "pending"}`,
    );

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error updating message:", error);
    throw new HttpsError("internal", "Failed to update message.");
  }
}
