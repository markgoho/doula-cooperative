#!/usr/bin/env bun

/**
 * Seed Test Data for Claim Profile Flow
 *
 * Resets test state and creates fresh test data in migrated_users_import
 * collection for testing the claim existing membership flow.
 *
 * What it does:
 *   1. Deletes existing member document (auth user deletes automatically via trigger)
 *   2. Creates fresh unclaimed profile in migrated_users_import
 *
 * Usage:
 *   bun run seed-claim-test                    # Emulator mode
 *   USE_EMULATOR=false bun run seed-claim-test # Production mode
 */

import {
  IMPORT_COLLECTION,
  MEMBERS_COLLECTION,
  type UnclaimedProfileDocumentData,
} from "@doula-coop/functions-shared/collections/index.js";
import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore, Timestamp } from "firebase-admin/firestore";

// Default configuration
const DEFAULT_SLUG = "marie-curie";

// Test email constant
const TEST_EMAIL = "test-existing-member@doulacooperative.com";

// Initialize Firebase Admin (emulator by default)
if (getApps().length === 0) {
  const useEmulator = process.env["USE_EMULATOR"] !== "false";

  if (useEmulator) {
    console.log("🔧 Using Firebase Emulators (safe mode)");
    process.env["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8090";
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
 * Get subscription start date (1 year ago from today)
 */
function getSubscriptionStart(): Date {
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
 * Clean up existing member document (auth user deletes automatically via trigger)
 */
async function cleanupExistingMember() {
  const auth = getAuth();

  // Find user by email to get UID
  try {
    const user = await auth.getUserByEmail(TEST_EMAIL);
    console.log(`🗑️  Found existing user: ${user.uid}`);

    // Delete member document (this triggers auth user deletion automatically)
    const memberDocument = await firestore
      .collection(MEMBERS_COLLECTION)
      .doc(user.uid)
      .get();

    if (memberDocument.exists) {
      await memberDocument.ref.delete();
      console.log(
        `   ✓ Deleted member document (auth user will delete automatically)`,
      );
    } else {
      console.log(`   No member document found (OK)`);
    }
  } catch (error: unknown) {
    // User doesn't exist, that's fine
    if (
      error &&
      typeof error === "object" &&
      "code" in error &&
      error.code === "auth/user-not-found"
    ) {
      console.log(`   No existing user found (OK)`);
      return;
    }
    throw error;
  }
}

/**
 * Seed test profile data
 */
async function seedTestProfile() {
  const subscriptionStart = getSubscriptionStart();
  const nextPayment = calculateNextPayment(subscriptionStart);
  const legacyCreatedAt = calculateLegacyCreatedAt();
  const slug = DEFAULT_SLUG;

  // Display configuration
  console.log(`📧 Email: ${TEST_EMAIL}`);
  console.log(`📅 Subscription Start: ${formatDate(subscriptionStart)}`);
  console.log(`📅 Next Payment: ${formatDate(nextPayment)}`);
  console.log(`🔗 Slug: ${slug}`);
  console.log(`📅 Profile Created: ${formatDate(legacyCreatedAt)}`);

  // Clean up any existing member/auth user first
  console.log("\n🔄 Resetting test state...");
  await cleanupExistingMember();

  // Prepare to write import document
  const documentReference = firestore
    .collection(IMPORT_COLLECTION)
    .doc(TEST_EMAIL);

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
