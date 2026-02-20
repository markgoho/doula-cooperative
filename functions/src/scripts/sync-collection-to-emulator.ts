/**
 * Script to sync a Firestore collection from production to emulator
 * This reads all documents from a production collection and writes them to the emulator.
 *
 * Usage:
 * 1. Ensure Firebase emulators are running (bun run emulators:start)
 * 2. Run: cd functions && bun run src/scripts/sync-collection-to-emulator.ts
 * 3. Select a collection from the interactive menu
 *
 * Or specify collection directly:
 * cd functions && bun run src/scripts/sync-collection-to-emulator.ts <collection-name>
 */

/* eslint-disable unicorn/no-process-exit */
/* eslint-disable unicorn/prefer-top-level-await */

import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import * as readline from "node:readline";
import {
  IMPORT_COLLECTION,
  MATCH_REQUESTS_COLLECTION,
  MEMBERS_COLLECTION,
  MESSAGES_COLLECTION,
  PROCESSED_STRIPE_EVENTS_COLLECTION,
} from "../collections/index.js";

// Available collections with friendly names
const AVAILABLE_COLLECTIONS = [
  { name: "Members", value: MEMBERS_COLLECTION },
  {
    name: "Migrated Users Import (Unclaimed Profiles)",
    value: IMPORT_COLLECTION,
  },
  { name: "Match Requests", value: MATCH_REQUESTS_COLLECTION },
  { name: "Messages (Contact Form)", value: MESSAGES_COLLECTION },
  {
    name: "Processed Stripe Events",
    value: PROCESSED_STRIPE_EVENTS_COLLECTION,
  },
] as const;

async function promptForCollection(): Promise<string> {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    console.log("\n📚 Available Collections:\n");
    const collectionList = AVAILABLE_COLLECTIONS.map(
      (collection, index) =>
        `  ${index + 1}. ${collection.name} (${collection.value})`,
    ).join("\n");
    console.log(collectionList);
    console.log("");

    rl.question("Select a collection (1-5): ", answer => {
      rl.close();
      const index = Number.parseInt(answer.trim(), 10) - 1;

      if (
        Number.isNaN(index) ||
        index < 0 ||
        index >= AVAILABLE_COLLECTIONS.length
      ) {
        console.error("❌ Invalid selection");
        process.exit(1);
      }

      const selected = AVAILABLE_COLLECTIONS[index];
      if (!selected) {
        console.error("❌ Invalid selection");
        process.exit(1);
      }

      resolve(selected.value);
    });
  });
}

async function getCollectionName(): Promise<string> {
  // Check if collection name provided as argument
  const collectionArgument = process.argv[2];

  if (collectionArgument) {
    // Validate it's a known collection
    const isValid = AVAILABLE_COLLECTIONS.some(
      c => c.value === collectionArgument,
    );
    if (!isValid) {
      console.error(`❌ Unknown collection: ${collectionArgument}`);
      console.error(
        `Available collections: ${AVAILABLE_COLLECTIONS.map(c => c.value).join(", ")}`,
      );
      process.exit(1);
    }
    return collectionArgument;
  }

  // Otherwise, prompt user
  return promptForCollection();
}

const COLLECTION_NAME = await getCollectionName();

async function syncCollectionToEmulator() {
  console.log("=".repeat(60));
  console.log(`SYNCING COLLECTION: ${COLLECTION_NAME}`);
  console.log("=".repeat(60));
  console.log("");

  // Initialize production app
  console.log("📡 Connecting to PRODUCTION Firestore...");
  const productionApp = initializeApp(
    {
      projectId: "doula-cooperative",
    },
    "production",
  );
  const productionDatabase = getFirestore(productionApp);

  // Initialize emulator app
  console.log("🔧 Connecting to EMULATOR Firestore at localhost:8090...");
  process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8090";
  process.env["GCLOUD_PROJECT"] = "doula-cooperative";

  const emulatorApp = initializeApp({
    projectId: "doula-cooperative",
  });
  const emulatorDatabase = getFirestore(emulatorApp);

  try {
    // Read all documents from production
    console.log(
      `\n📖 Reading documents from production collection "${COLLECTION_NAME}"...`,
    );
    const snapshot = await productionDatabase.collection(COLLECTION_NAME).get();

    if (snapshot.empty) {
      console.log(`⚠️  Collection "${COLLECTION_NAME}" is empty in production`);
      return;
    }

    console.log(`✅ Found ${snapshot.size} documents\n`);

    // Write documents to emulator
    console.log(`💾 Writing documents to emulator...`);
    let successCount = 0;
    let errorCount = 0;

    for (const document of snapshot.docs) {
      try {
        const data = document.data();
        await emulatorDatabase
          .collection(COLLECTION_NAME)
          .doc(document.id)
          .set(data);
        process.stdout.write(".");
        successCount++;
      } catch (error) {
        console.error(`\n❌ Error writing document ${document.id}:`, error);
        errorCount++;
      }
    }

    // Final summary
    console.log("\n");
    console.log("=".repeat(60));
    console.log("SYNC COMPLETE");
    console.log("=".repeat(60));
    console.log(`Collection: ${COLLECTION_NAME}`);
    console.log(`✅ Successfully synced: ${successCount} documents`);
    if (errorCount > 0) {
      console.log(`❌ Errors: ${errorCount}`);
    }
    console.log("=".repeat(60));
  } catch (error: unknown) {
    console.error("\n❌ Error during sync:", error);
    process.exit(1);
  }
}

syncCollectionToEmulator()
  .then(() => {
    console.log("\n✨ Script completed successfully");
    process.exit(0);
  })
  .catch((error: unknown) => {
    console.error("\n❌ Script failed:", error);
    process.exit(1);
  });
