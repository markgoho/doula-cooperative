import {
  MATCH_REQUESTS_COLLECTION,
  type MatchRequestDocument,
} from "@doula-coop/functions-shared/collections/match-requests.js";
import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { NotFoundError } from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { getFirestore } from "firebase-admin/firestore";
import {
  toMatchRequestResponse,
  type MatchRequestResponse,
} from "../schemas/match-request-schemas.js";

export async function getMatchRequest(options: {
  requestId: string;
  logger: Logger;
}): Promise<MatchRequestResponse> {
  const { requestId, logger } = options;

  const firestore = getFirestore();
  const documentReference = firestore
    .collection(MATCH_REQUESTS_COLLECTION)
    .doc(requestId);
  const document = await documentReference.get();

  if (!document.exists) {
    logger.warn("Match request not found", {
      errorId: ERROR_IDS.API_MATCH_REQUEST_NOT_FOUND,
      requestId,
    });
    throw new NotFoundError(`Match request with ID ${requestId} not found`);
  }

  return toMatchRequestResponse(
    document.id,
    document.data() as MatchRequestDocument,
  );
}
