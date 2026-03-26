/* eslint-disable unicorn/no-process-exit */
/* eslint-disable unicorn/prefer-top-level-await */

import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { Socket } from "node:net";
import { MEMBERS_COLLECTION } from "../collections/index.js";

const USE_EMULATOR = process.env["USE_EMULATOR"] !== "false";
const PROFILE_APPROVAL_CUTOFF = new Timestamp(0, 1);
const MAX_BATCH_SIZE = 500;

function isEmulatorReachable(port: number, host = "127.0.0.1"): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new Socket();

    const cleanup = () => {
      socket.removeAllListeners();
      socket.destroy();
    };

    socket.setTimeout(500);
    socket.once("connect", () => {
      cleanup();
      resolve(true);
    });
    socket.once("timeout", () => {
      cleanup();
      resolve(false);
    });
    socket.once("error", () => {
      cleanup();
      resolve(false);
    });

    socket.connect(port, host);
  });
}

async function configureFirestoreTarget(): Promise<boolean> {
  if (!USE_EMULATOR) {
    return true;
  }

  const emulatorReady = await isEmulatorReachable(8090);
  if (!emulatorReady) {
    console.warn(
      "⚠️ Firestore emulator is not running on 127.0.0.1:8090. Start the emulator to run this backfill locally.",
    );
    return false;
  }

  process.env["FIRESTORE_EMULATOR_HOST"] = "127.0.0.1:8090";
  process.env["GCLOUD_PROJECT"] = "doula-cooperative";
  console.log("🔧 Using Firebase Firestore Emulator at 127.0.0.1:8090");
  return true;
}

/**
 * Backfill allowProfileEditing for members who were previously approved via
 * profileApprovedAt before the explicit boolean permission field existed.
 *
 * Timestamp(0, 1) acts as a sentinel for "any real approval timestamp" while
 * excluding documents where profileApprovedAt was never set.
 */
async function backfillAllowProfileEditing(): Promise<void> {
  const targetReady = await configureFirestoreTarget();
  if (!targetReady) {
    return;
  }

  if (getApps().length === 0) {
    initializeApp({
      projectId: "doula-cooperative",
    });
  }

  const firestore = getFirestore();
  const snapshot = await firestore
    .collection(MEMBERS_COLLECTION)
    .where("profileApprovedAt", ">", PROFILE_APPROVAL_CUTOFF)
    .get();

  if (snapshot.empty) {
    console.log("✅ No members require profile editing backfill.");
    return;
  }

  console.log(`Found ${snapshot.docs.length} members to backfill.`);

  let updatedCount = 0;
  for (let index = 0; index < snapshot.docs.length; index += MAX_BATCH_SIZE) {
    const batch = firestore.batch();

    for (const document of snapshot.docs.slice(index, index + MAX_BATCH_SIZE)) {
      batch.update(document.ref, {
        allowProfileEditing: true,
      });
      updatedCount++;
    }

    await batch.commit();
    process.stdout.write(".");
  }

  console.log(`\n✅ Backfilled profile editing permission for ${updatedCount} members.`);
}

backfillAllowProfileEditing()
  .then(() => {
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("❌ Failed to backfill profile editing permission:", error);
    process.exit(1);
  });
