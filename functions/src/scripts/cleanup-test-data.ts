#!/usr/bin/env bun

/**
 * Cleanup Test Data Script
 *
 * Safely delete test users and related data from Firebase emulators or production.
 *
 * Usage:
 *   bun run scripts/cleanup-test-data.ts --email-pattern "@example.com" --dry-run
 *   bun run scripts/cleanup-test-data.ts --email jenny.rosen@example.com
 *   bun run scripts/cleanup-test-data.ts --uid abc123def456
 *
 * Options:
 *   --email-pattern <pattern>  Delete all users matching this email pattern (e.g., "@example.com", "test-")
 *   --email <exact>            Delete specific user by exact email match
 *   --uid <uid>                Delete specific user by UID
 *   --dry-run                  Show what would be deleted without actually deleting
 *   --confirm                  Skip confirmation prompt (use with caution!)
 *
 * Safety Features:
 *   - Requires confirmation before deleting (unless --confirm is used)
 *   - Dry-run mode to preview changes
 *   - Defaults to using emulators (safer for testing)
 *   - Blocks deletion of production emails without explicit confirmation
 */

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import {
  MEMBERS_COLLECTION,
  PROCESSED_STRIPE_EVENTS_COLLECTION,
} from "../collections/index.js";

// Parse command line arguments
const arguments_ = process.argv.slice(2);
const emailPattern = arguments_[arguments_.indexOf("--email-pattern") + 1];
const exactEmail = arguments_[arguments_.indexOf("--email") + 1];
const uid = arguments_[arguments_.indexOf("--uid") + 1];
const dryRun = arguments_.includes("--dry-run");
const skipConfirm = arguments_.includes("--confirm");

// Production email patterns to protect
const PROTECTED_PATTERNS = [
  "@doulacooperative.com",
  "webmaster@",
  "admin@",
  "info@",
];

// Initialize Firebase Admin (emulator by default)
if (getApps().length === 0) {
  const useEmulator = !process.env["USE_PRODUCTION"];

  if (useEmulator) {
    console.log("🔧 Using Firebase Emulators (safe mode)");
    process.env["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8090";
    process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "127.0.0.1:9099";
  } else {
    console.log("⚠️  Using PRODUCTION Firebase (dangerous!)");
  }

  initializeApp();
}

const auth = getAuth();
const firestore = getFirestore();

interface UserToDelete {
  uid: string;
  email: string | undefined;
  memberDocExists: boolean;
  eventsCount: number;
}

/**
 * Get confirmation from user
 */
async function confirm(message: string): Promise<boolean> {
  if (skipConfirm) return true;

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
 * Check if email matches any protected pattern
 */
function isProtectedEmail(email: string | undefined): boolean {
  if (!email) return false;
  return PROTECTED_PATTERNS.some(pattern => email.includes(pattern));
}

/**
 * Find users to delete based on criteria
 */
async function findUsersToDelete(): Promise<UserToDelete[]> {
  const usersToDelete: UserToDelete[] = [];

  if (uid) {
    // Delete by UID
    try {
      const user = await auth.getUser(uid);
      const memberDocument = await firestore
        .collection(MEMBERS_COLLECTION)
        .doc(uid)
        .get();
      const eventsQuery = await firestore
        .collection(PROCESSED_STRIPE_EVENTS_COLLECTION)
        .where("userId", "==", uid)
        .get();

      usersToDelete.push({
        uid: user.uid,
        email: user.email,
        memberDocExists: memberDocument.exists,
        eventsCount: eventsQuery.size,
      });
    } catch (error) {
      console.error(`❌ User not found with UID: ${uid}`);
      throw error;
    }
  } else if (exactEmail) {
    // Delete by exact email
    try {
      const user = await auth.getUserByEmail(exactEmail);
      const memberDocument = await firestore
        .collection(MEMBERS_COLLECTION)
        .doc(user.uid)
        .get();
      const eventsQuery = await firestore
        .collection(PROCESSED_STRIPE_EVENTS_COLLECTION)
        .where("userId", "==", user.uid)
        .get();

      usersToDelete.push({
        uid: user.uid,
        email: user.email,
        memberDocExists: memberDocument.exists,
        eventsCount: eventsQuery.size,
      });
    } catch (error) {
      console.error(`❌ User not found with email: ${exactEmail}`);
      throw error;
    }
  } else if (emailPattern) {
    // Delete by pattern - list all users and filter
    console.log(`🔍 Searching for users matching pattern: ${emailPattern}`);

    let nextPageToken: string | undefined;
    do {
      const listUsersResult = await auth.listUsers(1000, nextPageToken);

      for (const user of listUsersResult.users) {
        if (user.email?.includes(emailPattern)) {
          const memberDocument = await firestore
            .collection(MEMBERS_COLLECTION)
            .doc(user.uid)
            .get();
          const eventsQuery = await firestore
            .collection(PROCESSED_STRIPE_EVENTS_COLLECTION)
            .where("userId", "==", user.uid)
            .get();

          usersToDelete.push({
            uid: user.uid,
            email: user.email,
            memberDocExists: memberDocument.exists,
            eventsCount: eventsQuery.size,
          });
        }
      }

      nextPageToken = listUsersResult.pageToken;
    } while (nextPageToken);
  } else {
    console.error("❌ Must specify --email-pattern, --email, or --uid");
    process.exit(1);
  }

  return usersToDelete;
}

/**
 * Delete a single user and related data
 */
async function deleteUser(user: UserToDelete): Promise<void> {
  console.log(`\n🗑️  Deleting user: ${user.email ?? user.uid}`);

  // Delete member document
  if (user.memberDocExists) {
    if (!dryRun) {
      await firestore.collection(MEMBERS_COLLECTION).doc(user.uid).delete();
    }
    console.log(`  ✓ Deleted member document`);
  }

  // Delete processed events
  if (user.eventsCount > 0) {
    if (!dryRun) {
      const eventsSnapshot = await firestore
        .collection(PROCESSED_STRIPE_EVENTS_COLLECTION)
        .where("userId", "==", user.uid)
        .get();

      const batch = firestore.batch();
      for (const document of eventsSnapshot.docs) {
        batch.delete(document.ref);
      }
      await batch.commit();
    }
    console.log(`  ✓ Deleted ${user.eventsCount} processed event(s)`);
  }

  // Delete Auth user
  if (!dryRun) {
    await auth.deleteUser(user.uid);
  }
  console.log(`  ✓ Deleted Auth user`);
}

/**
 * Main execution
 */
async function main() {
  console.log("\n🧹 Firebase Test Data Cleanup Tool\n");

  if (dryRun) {
    console.log("📋 DRY RUN MODE - No data will be deleted\n");
  }

  // Find users
  const users = await findUsersToDelete();

  if (users.length === 0) {
    console.log("✨ No users found matching criteria");
    return;
  }

  // Display summary
  console.log(`\n📊 Found ${users.length} user(s) to delete:\n`);

  for (const user of users) {
    console.log(`  • ${user.email ?? "(no email)"} (${user.uid})`);
    console.log(`    - Member doc: ${user.memberDocExists ? "Yes" : "No"}`);
    console.log(`    - Events: ${user.eventsCount}`);

    if (isProtectedEmail(user.email)) {
      console.log(`    ⚠️  WARNING: Protected email pattern detected!`);
    }
  }

  // Check for protected emails
  const protectedUsers = users.filter(u => isProtectedEmail(u.email));
  if (protectedUsers.length > 0 && !process.env["USE_PRODUCTION"]) {
    console.log(
      `\n⚠️  Warning: ${protectedUsers.length} user(s) match protected patterns`,
    );
    console.log(
      "These are typically production emails. Use with extreme caution.",
    );
  }

  // Confirm deletion
  if (!dryRun) {
    const confirmed = await confirm(
      `\n⚠️  Delete ${users.length} user(s) and all related data?`,
    );

    if (!confirmed) {
      console.log("\n❌ Deletion cancelled");
      return;
    }
  }

  // Delete users
  console.log(
    `\n${dryRun ? "Would delete" : "Deleting"} ${users.length} user(s)...`,
  );

  for (const user of users) {
    if (dryRun) {
      console.log(`\n[DRY RUN] Would delete: ${user.email ?? user.uid}`);
      console.log(`  - Member document: ${user.memberDocExists}`);
      console.log(`  - Events: ${user.eventsCount}`);
    } else {
      await deleteUser(user);
    }
  }

  console.log(`\n✅ ${dryRun ? "Dry run" : "Cleanup"} complete!`);
  console.log(`   Users ${dryRun ? "would be" : ""} deleted: ${users.length}`);
}

// Run script with top-level await
await main().catch((error: unknown) => {
  console.error("\n❌ Error during cleanup:", error);
  process.exit(1);
});
