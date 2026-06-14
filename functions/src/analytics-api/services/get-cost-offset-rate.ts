import { Timestamp, getFirestore } from "firebase-admin/firestore";
import { MATCH_REQUESTS_COLLECTION } from "../../collections/match-requests.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { CostOffsetRateResponse } from "../schemas/analytics-schemas.js";

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Returns cost offset rate for match requests submitted in last 30 days.
 * withOffset = docs with non-empty insurance[].
 */
export async function getCostOffsetRate({
  logger,
}: {
  logger: Logger;
}): Promise<CostOffsetRateResponse> {
  try {
    const firestore = getFirestore();
    const since = Timestamp.fromDate(new Date(Date.now() - THIRTY_DAYS_MS));

    const snapshot = await firestore
      .collection(MATCH_REQUESTS_COLLECTION)
      .where("submitted", ">=", since)
      .get();

    let withOffset = 0;
    for (const document_ of snapshot.docs) {
      const data = document_.data();
      if (Array.isArray(data["insurance"]) && data["insurance"].length > 0) {
        withOffset++;
      }
    }

    const total = snapshot.size;
    const rate = total === 0 ? 0 : Math.round((withOffset / total) * 100) / 100;

    return { withOffset, total, rate };
  } catch (error) {
    logger.error("Failed to fetch cost offset rate", {
      errorId: ERROR_IDS.API_FIRESTORE_READ_FAILED,
      error,
    });
    throw error;
  }
}
