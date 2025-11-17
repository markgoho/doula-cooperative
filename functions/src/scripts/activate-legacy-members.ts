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
import { IMPORT_COLLECTION } from "../collections/index.js";
import { ERROR_IDS } from "../constants/index.js";
import { calculateExpirationDate } from "../utils/membership-dates.js";

// Initialize Firebase Admin if not already initialized
if (getApps().length === 0) {
  initializeApp();
}

interface MigratedUserData {
  name: string;
  subscriptionStart: Timestamp;
  slug?: string;
  email?: string;
}

interface FailureRecord {
  email: string;
  reason: 'invalid_data' | 'firestore_error';
  error?: unknown;
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
  const failures: FailureRecord[] = [];

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
      failures.push({ email, reason: 'invalid_data' });
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
      failures.push({ email, reason: 'firestore_error', error });

      // Check if this is a systemic error (many consecutive failures)
      if (failures.length > 5 && successCount === 0) {
        logger.error("Multiple consecutive failures - aborting script", {
          errorId: ERROR_IDS.LEGACY_ACTIVATION_SYSTEMIC_FAILURE,
          failureCount: failures.length,
          successCount,
          failedEmails: failures.map(f => f.email),
        });
        throw new Error(
          `Script aborted due to systemic failures. ${failures.length} members failed, 0 succeeded. Failed emails: ${failures.map(f => f.email).join(', ')}`
        );
      }
    }
  }

  // Report results
  const totalProcessed = successCount + failures.length;
  const invalidDataCount = failures.filter(f => f.reason === 'invalid_data').length;
  const firestoreErrorCount = failures.filter(f => f.reason === 'firestore_error').length;

  logger.info(
    `Legacy member activation complete. Success: ${String(successCount)}/${String(totalProcessed)}, Invalid Data: ${String(invalidDataCount)}, Firestore Errors: ${String(firestoreErrorCount)}`,
  );

  // If there were any failures, throw an error with details
  if (failures.length > 0) {
    const failedEmails = failures.map(f => f.email).join(', ');
    logger.error("Script completed with failures", {
      errorId: ERROR_IDS.LEGACY_ACTIVATION_FIRESTORE_FAILED,
      failureCount: failures.length,
      successCount,
      failedEmails,
      failures: failures.map(f => ({ email: f.email, reason: f.reason })),
    });
    throw new Error(
      `Failed to activate ${failures.length} member(s): ${failedEmails}. Please review logs and retry failed members manually.`
    );
  }
}
