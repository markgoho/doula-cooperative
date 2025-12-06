#!/usr/bin/env bun

/**
 * Seed Test Data for Claim Profile Flow
 *
 * Creates test data in migrated_users_import collection for testing
 * the claim existing membership flow.
 *
 * Usage:
 *   bun run seed-claim-test                           # Default: emulator, 1yr ago dates
 *   bun run seed-claim-test --subscription-start "2024-01-15"
 *   bun run seed-claim-test --slug "test-existing-doula"
 *   USE_EMULATOR=false bun run seed-claim-test        # Production mode
 *   bun run seed-claim-test --force                   # Skip confirmation
 *
 * Safety:
 *   - Defaults to emulator (USE_EMULATOR env var)
 *   - Prompts before overwriting existing data
 *   - Clear visual feedback with emojis
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import {
  IMPORT_COLLECTION,
  type UnclaimedProfileDocumentData,
} from "../collections/index.js";

// Parse command line arguments
const arguments_ = process.argv.slice(2);
const subscriptionStartArgument =
  arguments_[arguments_.indexOf("--subscription-start") + 1];
const slugArgument = arguments_[arguments_.indexOf("--slug") + 1];
const forceOverwrite = arguments_.includes("--force");

// Test email constant
const TEST_EMAIL = "test-existing-member@doulacooperative.com";

// Initialize Firebase Admin (emulator by default)
if (getApps().length === 0) {
  const useEmulator = process.env["USE_EMULATOR"] !== "false";

  if (useEmulator) {
    console.log("🔧 Using Firebase Emulators (safe mode)");
    process.env["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8080";
    process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "127.0.0.1:9099";
    process.env["GCLOUD_PROJECT"] = "doula-cooperative";
  } else {
    console.log("⚠️  Using PRODUCTION Firebase (doula-cooperative)");
    process.env["GCLOUD_PROJECT"] = "doula-cooperative";
  }

  initializeApp({ projectId: "doula-cooperative" });
}

const firestore = getFirestore();

/**
 * Get confirmation from user
 */
async function confirm(message: string): Promise<boolean> {
  if (forceOverwrite) return true;

  console.log(`\n${message}`);
  console.log("Type 'yes' to confirm, anything else to cancel:");

  const readline = await import("node:readline");
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise(resolve => {
    rl.question("> ", answer => {
      rl.close();
      resolve(answer.toLowerCase() === "yes");
    });
  });
}

/**
 * Parse subscription start date from CLI arg
 */
function parseSubscriptionStart(): Date {
  if (subscriptionStartArgument && subscriptionStartArgument !== "undefined") {
    const parsed = new Date(subscriptionStartArgument);
    if (Number.isNaN(parsed.getTime())) {
      console.error(
        `❌ Invalid date format: ${subscriptionStartArgument}`,
      );
      console.error('   Expected format: "2024-01-15" or "2024-01-15T10:30:00Z"');
      process.exit(1);
    }
    return parsed;
  }

  // Default: 1 year ago from today
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return oneYearAgo;
}

/**
 * Calculate next payment date (1 year from subscription start)
 */
function calculateNextPayment(subscriptionStart: Date): Date {
  const nextPayment = new Date(subscriptionStart);
  nextPayment.setFullYear(nextPayment.getFullYear() + 1);
  return nextPayment;
}

/**
 * Calculate legacy profile creation date (2 years ago)
 */
function calculateLegacyCreatedAt(): Date {
  const twoYearsAgo = new Date();
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2);
  return twoYearsAgo;
}

/**
 * Format date for console output
 */
function formatDate(date: Date): string {
  const datePart = date.toISOString().split("T")[0];
  if (!datePart) {
    throw new Error("Failed to format date");
  }
  return datePart;
}

/**
 * Seed test profile data
 */
async function seedTestProfile() {
  const subscriptionStart = parseSubscriptionStart();
  const nextPayment = calculateNextPayment(subscriptionStart);
  const legacyCreatedAt = calculateLegacyCreatedAt();
  const slug = slugArgument ?? "marie-curie";

  // Display configuration
  console.log(`📧 Email: ${TEST_EMAIL}`);
  console.log(`📅 Subscription Start: ${formatDate(subscriptionStart)}`);
  console.log(`📅 Next Payment: ${formatDate(nextPayment)}`);
  console.log(`🔗 Slug: ${slug}`);
  console.log(`📅 Profile Created: ${formatDate(legacyCreatedAt)}`);

  // Check if document exists
  const documentReference = firestore.collection(IMPORT_COLLECTION).doc(TEST_EMAIL);
  const existingDocument = await documentReference.get();

  if (existingDocument.exists) {
    const confirmed = await confirm("⚠️  Document already exists. Overwrite?");
    if (!confirmed) {
      console.log("\n❌ Cancelled - no changes made");
      return;
    }
  }

  // Prepare profile data
  const profileData: UnclaimedProfileDocumentData = {
    name: "Marie Curie",
    email: TEST_EMAIL,
    subscriptionStart: Timestamp.fromDate(subscriptionStart),
    lastPayment: Timestamp.fromDate(subscriptionStart),
    nextPayment: Timestamp.fromDate(nextPayment),
    slug,
    createdAt: Timestamp.fromDate(legacyCreatedAt),
  };

  // Write to Firestore
  console.log("\n💾 Writing test profile to migrated_users_import...");
  await documentReference.set(profileData);

  console.log("✅ Successfully seeded test profile!");
  console.log("\nNext steps to test claim flow:");
  console.log(`1. Create auth user: ${TEST_EMAIL}`);
  console.log("2. Verify email in Firebase Auth UI");
  console.log("3. Sign in and call claimProfile()");
  console.log("4. Verify member doc created with membershipActive=true");
  console.log("5. Verify import doc deleted");
}

/**
 * Main execution
 */
async function main() {
  console.log("\n🌱 Seed Test Data for Claim Profile Flow\n");

  try {
    await seedTestProfile();
  } catch (error) {
    console.error("\n❌ Error seeding test data:", error);
    process.exit(1);
  }
}

// Run script with top-level await
await main();
