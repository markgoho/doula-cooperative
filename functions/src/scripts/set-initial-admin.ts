/**
 * Script to set initial admin claim for webmaster@doulacooperative.com
 * This should be run manually in a local environment or via Firebase CLI.
 *
 * Usage:
 * 1. Ensure Firebase emulators are running (bun run emulators:start)
 * 2. Run: cd functions && bun run src/scripts/set-initial-admin.ts
 *
 * For production:
 * Use Firebase CLI: firebase functions:shell
 * Then call: auth.setCustomUserClaims(uid, { admin: true })
 */

/* eslint-disable unicorn/no-process-exit */

import { getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

const ADMIN_EMAIL = "webmaster@doulacooperative.com";
// For local emulator, you can hardcode the UID from the emulator UI
const ADMIN_UID = process.env["ADMIN_UID"] ?? "";
const SHOULD_USE_EMULATOR = process.env["USE_EMULATOR"] !== "false";

async function setInitialAdmin() {
  // Connect to Auth emulator BEFORE initializing (must set env var first)
  if (SHOULD_USE_EMULATOR) {
    process.env["FIREBASE_AUTH_EMULATOR_HOST"] = "localhost:9099";
    process.env["GCLOUD_PROJECT"] = "doula-cooperative";
    console.log("🔧 Using Firebase Auth Emulator at localhost:9099");
  }

  // Initialize Firebase Admin if not already initialized
  if (getApps().length === 0) {
    initializeApp({
      projectId: "doula-cooperative",
    });
  }

  const auth = getAuth();

  try {
    let user;

    // If UID is provided, use it directly (faster for emulator)
    if (ADMIN_UID) {
      console.log(`Looking up user by UID: ${ADMIN_UID}`);
      user = await auth.getUser(ADMIN_UID);
    } else {
      console.log(`Looking up user by email: ${ADMIN_EMAIL}`);
      user = await auth.getUserByEmail(ADMIN_EMAIL);
    }

    console.log(`Found user: ${user.email} (UID: ${user.uid})`);

    // Set admin custom claim
    await auth.setCustomUserClaims(user.uid, { admin: true });

    console.log(`✅ Admin claim successfully set for ${user.email}`);

    // Verify the claim was set
    const updatedUser = await auth.getUser(user.uid);
    console.log("Custom claims:", updatedUser.customClaims);
  } catch (error: unknown) {
    if ((error as { code?: string }).code === "auth/user-not-found") {
      console.error(
        `❌ User ${ADMIN_EMAIL} not found. Please create this account first.`,
      );
    } else {
      console.error("❌ Error setting admin claim:", error);
    }
    process.exit(1);
  }
}

try {
  await setInitialAdmin();
  console.log("Script completed successfully");
  process.exit(0);
} catch (error: unknown) {
  console.error("Script failed:", error);
  process.exit(1);
}
