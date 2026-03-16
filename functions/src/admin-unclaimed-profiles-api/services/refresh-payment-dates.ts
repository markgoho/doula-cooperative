import {
  IMPORT_COLLECTION,
  type UnclaimedProfileDocumentData,
} from "@doula-coop/functions-shared/collections/migrated-users-import.js";
import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { Timestamp, getFirestore } from "firebase-admin/firestore";
import type { RefreshPaymentDatesSuccessResponse } from "../schemas/unclaimed-profile-schemas.js";

interface RefreshPaymentDatesOptions {
  logger: Logger;
}

const ONE_YEAR_MS = 365.25 * 24 * 60 * 60 * 1000;
const MAX_BATCH_SIZE = 500;

function advanceByOneYear(timestamp: Timestamp): Timestamp {
  const date = timestamp.toDate();
  const advanced = new Date(date.getTime() + ONE_YEAR_MS);
  return Timestamp.fromDate(advanced);
}

export async function refreshPaymentDates({
  logger,
}: RefreshPaymentDatesOptions): Promise<RefreshPaymentDatesSuccessResponse> {
  try {
    const firestore = getFirestore();
    const importCollection = firestore.collection(IMPORT_COLLECTION);

    const snapshot = await importCollection.get();
    const now = Timestamp.now();
    const totalCount = snapshot.docs.length;
    let updatedCount = 0;

    let batch = firestore.batch();
    let batchCount = 0;

    for (const document of snapshot.docs) {
      const data = document.data() as UnclaimedProfileDocumentData;
      let { lastPayment, nextPayment } = data;
      let needsUpdate = false;

      // Advance dates by 1 year until nextPayment is in the future
      while (nextPayment.toMillis() < now.toMillis()) {
        lastPayment = advanceByOneYear(lastPayment);
        nextPayment = advanceByOneYear(nextPayment);
        needsUpdate = true;
      }

      if (needsUpdate) {
        batch.update(document.ref, { lastPayment, nextPayment });
        batchCount++;
        updatedCount++;

        // Commit when batch is full
        if (batchCount >= MAX_BATCH_SIZE) {
          await batch.commit();
          batch = firestore.batch();
          batchCount = 0;
        }
      }
    }

    // Commit remaining updates
    if (batchCount > 0) {
      await batch.commit();
    }

    logger.info("Refreshed payment dates for unclaimed profiles", {
      updatedCount,
      totalCount,
    });

    return { success: true, updatedCount, totalCount };
  } catch (error) {
    logger.error("Failed to refresh payment dates", {
      errorId: ERROR_IDS.API_ADMIN_REFRESH_PAYMENT_DATES_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    });
    throw error;
  }
}
