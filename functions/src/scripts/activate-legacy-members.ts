/**
 * One-time script to activate legacy members (users with migrated profiles)
 *
 * This script:
 * 1. Queries all documents in the migrated_users_import collection
 * 2. For each document, sets membershipActive: true
 * 3. Calculates and sets membership expiration dates
 *
 * Run with: bun run ts-node src/scripts/activate-legacy-members.ts
 * Or deploy as a callable function and invoke once.
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { logger } from "firebase-functions/v2";
import { ERROR_IDS, IMPORT_COLLECTION } from "../constants";
import { calculateExpirationDate } from "../utils/membership-dates";

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

interface MigratedUserData {
  name: string;
  subscriptionStart: Timestamp;
  hasProfile?: boolean;
  email?: string;
}

export async function activateLegacyMembers(): Promise<void> {
  const database = getFirestore();

  logger.info("Starting legacy member activation...");

  // Get all documents from migrated_users_import collection
  const importCollection = database.collection(IMPORT_COLLECTION);
  const snapshot = await importCollection.get();

  if (snapshot.empty) {
    logger.info("No legacy members found in import collection.");
    return;
  }

  logger.info(`Found ${String(snapshot.size)} legacy member(s) to activate.`);

  let successCount = 0;
  let errorCount = 0;
  let invalidDataCount = 0;

  for (const document of snapshot.docs) {
    const email = document.id;
    const data = document.data() as MigratedUserData;

    // Validate data first
    if (!(data.subscriptionStart instanceof Timestamp)) {
      logger.error(`Invalid subscriptionStart for ${email}`, {
        errorId: ERROR_IDS.LEGACY_ACTIVATION_INVALID_DATA,
        email,
        hasSubscriptionStart: !!data.subscriptionStart,
      });
      invalidDataCount++;
      continue;
    }

    try {
      const membershipExpiresAt = calculateExpirationDate(data.subscriptionStart);

      await document.ref.update({
        membershipActive: true,
        membershipExpiresAt,
      });

      const expiresDate = membershipExpiresAt.toDate().toISOString();
      logger.info(
        `Activated legacy member: ${email} (expires: ${expiresDate})`,
      );
      successCount++;
    } catch (error) {
      logger.error(`Failed to update Firestore document for ${email}`, {
        error,
        errorId: ERROR_IDS.LEGACY_ACTIVATION_FIRESTORE_FAILED,
        email,
      });

      // Check if this is a systemic error
      if (errorCount > 5 && successCount === 0) {
        logger.error("Multiple consecutive failures - aborting script", {
          errorId: ERROR_IDS.LEGACY_ACTIVATION_SYSTEMIC_FAILURE,
          errorCount,
          successCount,
        });
        throw new Error("Script aborted due to systemic failures");
      }

      errorCount++;
    }
  }

  logger.info(
    `Legacy member activation complete. Success: ${String(successCount)}, Errors: ${String(errorCount)}, Invalid Data: ${String(invalidDataCount)}`,
  );
}
