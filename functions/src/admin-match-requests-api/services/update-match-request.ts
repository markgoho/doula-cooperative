import { MATCH_REQUESTS_COLLECTION } from "@doula-coop/functions-shared/collections/match-requests.js";
import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { NotFoundError } from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { getFirestore } from "firebase-admin/firestore";

export async function updateMatchRequest(options: {
  requestId: string;
  sent: boolean;
  logger: Logger;
}): Promise<{ success: true }> {
  const { requestId, sent, logger } = options;

  const firestore = getFirestore();
  const documentReference = firestore
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(requestId);

  // Verify document exists
  const document = await documentReference.get();
  if (!document.exists) {
    logger.warn("Cannot update - match request not found", {
      errorId: ERROR_IDS.API_MATCH_REQUEST_NOT_FOUND,
      requestId,
    });
    throw new NotFoundError(`Match request with ID ${requestId} not found`);
  }

  // Update the sent status
  await documentReference.update({ sent });

  logger.info("Match request status updated", {
    requestId,
    sent,
    status: sent ? "processed" : "pending",
  });

  return { success: true };
}
