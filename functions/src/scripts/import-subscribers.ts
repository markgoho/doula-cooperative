import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readFileSync } from "node:fs";
import path from "node:path";
import { IMPORT_COLLECTION } from "../collections/index.js";

const USE_EMULATOR = process.env["USE_EMULATOR"] !== "false";

interface SubscriberJson {
  Name: string;
  Email: string;
  Slug: string;
  "Subscription Start": string;
  "Start Date": string;
  "Last Payment": string;
  "Next Payment": string;
}

async function importSubscribers() {
  // 1. Setup Emulator / Firebase
  if (USE_EMULATOR) {
    process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8080";
    process.env["GCLOUD_PROJECT"] = "doula-cooperative";
    console.log("🔧 Using Firebase Firestore Emulator at localhost:8080");
  }

  if (getApps().length === 0) {
    initializeApp({
      projectId: "doula-cooperative",
    });
  }

  const database = getFirestore();
  const collection = database.collection(IMPORT_COLLECTION);

  // 2. Read JSON file
  // Assuming script is run from 'functions' directory, so json is in parent '../Doula-Coop-Subscribers.json'
  const jsonPath = path.join(process.cwd(), "../Doula-Coop-Subscribers.json");
  console.log(`Reading subscribers from: ${jsonPath}`);

  let subscribers: SubscriberJson[] = [];
  try {
    const fileContent = readFileSync(jsonPath, "utf8");
    subscribers = JSON.parse(fileContent) as SubscriberJson[];
  } catch (error) {
    console.error(
      `❌ Error reading JSON file:`,
      error instanceof Error ? error.message : String(error),
    );
    throw new Error("Failed to read JSON file");
  }

  console.log(`Found ${subscribers.length} subscribers to import.`);

  let successCount = 0;
  let errorCount = 0;

  // 3. Iterate and write to Firestore
  for (const sub of subscribers) {
    const email = sub.Email;
    if (!email) {
      console.warn(`⚠️ Skipping entry with missing email: ${sub.Name}`);
      continue;
    }

    try {
      // Helper function to convert date string to Timestamp
      const toTimestamp = (dateString: string): Timestamp | undefined => {
        if (!dateString) return undefined;
        const date = new Date(dateString);
        return Number.isNaN(date.getTime())
          ? undefined
          : Timestamp.fromDate(date);
      };

      // Parse dates
      const subscriptionStart = toTimestamp(sub["Start Date"]);
      const lastPayment = toTimestamp(sub["Last Payment"]);
      const nextPayment = toTimestamp(sub["Next Payment"]);

      if (!subscriptionStart) {
        console.warn(`⚠️ Invalid start date for ${email}`);
        console.warn(`Skipping ${email} due to invalid date.`);
        errorCount++;
        continue;
      }

      // Map to Firestore document structure
      // Interface MigratedUserData { name: string; subscriptionStart: Timestamp; slug?: string; email?: string; }
      const documentData = {
        name: sub.Name,
        email: sub.Email,
        slug: sub.Slug,
        subscriptionStart,
        lastPayment,
        nextPayment,
      };

      // Write to Firestore
      await collection.doc(email).set(documentData);
      // console.log(`✅ Imported: ${email}`);
      process.stdout.write("."); // progress dot
      successCount++;
    } catch (error) {
      console.error(`\n❌ Error importing ${email}:`, error);
      errorCount++;
    }
  }

  console.log("\n\nImport complete!");
  console.log(`✅ Success: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
}

await importSubscribers();
