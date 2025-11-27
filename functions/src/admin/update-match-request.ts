import { getFirestore } from "firebase-admin/firestore";
import { logger } from "firebase-functions";
import { HttpsError, type CallableRequest } from "firebase-functions/v2/https";
import { MATCH_REQUESTS_COLLECTION } from "../collections/index.js";
import { verifyAdmin } from "./verify-admin.js";

export interface UpdateMatchRequestRequest {
  id: string;
  sent: boolean;
}

export interface UpdateMatchRequestResponse {
  success: boolean;
}

/**
 * Admin-only function to update a match request's status.
 * Currently only allows updating the 'sent' field.
 */
export async function handleUpdateMatchRequest(
  data: UpdateMatchRequestRequest,
  context: CallableRequest,
): Promise<UpdateMatchRequestResponse> {
  verifyAdmin(context);

  const { id, sent } = data;

  if (!id) {
    throw new HttpsError("invalid-argument", "Match request ID is required.");
  }

  if (typeof sent !== "boolean") {
    throw new HttpsError(
      "invalid-argument",
      "Status (sent) must be a boolean.",
    );
  }

  try {
    const firestore = getFirestore();
    const matchRequestReference = firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .doc(id);

    // Verify match request exists
    const matchRequestDocument = await matchRequestReference.get();
    if (!matchRequestDocument.exists) {
      throw new HttpsError(
        "not-found",
        `Match request with ID ${id} not found.`,
      );
    }

    // Update the sent status
    await matchRequestReference.update({ sent });

    logger.log(
      `Admin ${context.auth?.uid} updated match request ${id} status to ${sent ? "processed" : "pending"}`,
    );

    return { success: true };
  } catch (error) {
    if (error instanceof HttpsError) {
      throw error;
    }
    logger.error("Error updating match request:", error);
    throw new HttpsError("internal", "Failed to update match request.");
  }
}
