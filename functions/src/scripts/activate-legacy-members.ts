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
import { IMPORT_COLLECTION } from "../constants";

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

function calculateExpirationDate(subscriptionStart: Timestamp): Timestamp {
  const startDate = subscriptionStart.toDate();
  const monthIndex = startDate.getMonth(); // 0-11

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();

  let expirationYear = currentYear;

  // If the renewal month has already passed this year, or we are in the renewal month,
  // the next renewal is next year.
  if (
    currentMonth > monthIndex ||
    (currentMonth === monthIndex && now.getDate() > 1)
  ) {
    expirationYear += 1;
  }

  // Set the expiration to the last day of the subscription month in the expiration year.
  const expirationDate = new Date(expirationYear, monthIndex + 1, 0);
  return Timestamp.fromDate(expirationDate);
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

  // Process each document
  for (const document of snapshot.docs) {
    const email = document.id;
    const data = document.data() as MigratedUserData;

    try {
      const subscriptionStart = data.subscriptionStart;
      const membershipExpiresAt = calculateExpirationDate(subscriptionStart);

      // Update the document with membership activation
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
      logger.error(`Error activating legacy member ${email}:`, error);
      errorCount++;
    }
  }

  logger.info(
    `Legacy member activation complete. Success: ${String(successCount)}, Errors: ${String(errorCount)}`,
  );
}
