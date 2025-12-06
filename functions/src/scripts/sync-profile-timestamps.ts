import { getApps, initializeApp } from "firebase-admin/app";
import { getFirestore, Timestamp } from "firebase-admin/firestore";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { IMPORT_COLLECTION } from "../collections/index.js";

const USE_EMULATOR = process.env["USE_EMULATOR"] !== "false";

interface ProfileTimestamps {
  slug: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
}

/**
 * Parses front matter from a Hugo markdown file to extract timestamps
 */
function parseFrontMatter(
  filePath: string,
  slug: string,
): ProfileTimestamps | undefined {
  try {
    const content = readFileSync(filePath, "utf8");

    // Extract front matter between --- delimiters
    const frontMatterRegex = /^---\n([\S\s]*?)\n---/;
    const frontMatterMatch = frontMatterRegex.exec(content);
    if (!frontMatterMatch?.[1]) {
      console.warn(`⚠️ No front matter found in ${slug}/index.md`);
      return undefined;
    }

    const frontMatter = frontMatterMatch[1];

    // Extract createdAt and updatedAt using regex
    const createdAtRegex = /^createdAt:\s*(.+)$/m;
    const updatedAtRegex = /^updatedAt:\s*(.+)$/m;
    const createdAtMatch = createdAtRegex.exec(frontMatter);
    const updatedAtMatch = updatedAtRegex.exec(frontMatter);

    const result: ProfileTimestamps = { slug };

    if (createdAtMatch?.[1]) {
      const dateString = createdAtMatch[1].trim();
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) {
        console.warn(
          `⚠️ Invalid createdAt date in ${slug}/index.md: ${dateString}`,
        );
      } else {
        result.createdAt = Timestamp.fromDate(date);
      }
    }

    if (updatedAtMatch?.[1]) {
      const dateString = updatedAtMatch[1].trim();
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) {
        console.warn(
          `⚠️ Invalid updatedAt date in ${slug}/index.md: ${dateString}`,
        );
      } else {
        result.updatedAt = Timestamp.fromDate(date);
      }
    }

    return result;
  } catch (error) {
    console.error(
      `❌ Error reading ${slug}/index.md:`,
      error instanceof Error ? error.message : String(error),
    );
    return undefined;
  }
}

async function syncProfileTimestamps() {
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

  // 2. Read all doula profile directories
  // Assuming script is run from 'functions' directory
  const doulasPath = path.join(process.cwd(), "../hugo/content/doulas");
  console.log(`Reading doula profiles from: ${doulasPath}`);

  let profileDirectories: string[] = [];
  try {
    profileDirectories = readdirSync(doulasPath, { withFileTypes: true })
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);
  } catch (error) {
    console.error(
      `❌ Error reading doulas directory:`,
      error instanceof Error ? error.message : String(error),
    );
    throw new Error("Failed to read doulas directory");
  }

  console.log(`Found ${profileDirectories.length} doula profiles to process.`);

  let successCount = 0;
  let skippedCount = 0;
  let errorCount = 0;
  const failedSlugs: string[] = [];
  const skippedSlugs: { slug: string; reason: string }[] = [];

  // 3. Iterate through each profile directory
  for (const slug of profileDirectories) {
    const indexPath = path.join(doulasPath, slug, "index.md");
    const timestamps = parseFrontMatter(indexPath, slug);

    if (timestamps === undefined) {
      skippedCount++;
      skippedSlugs.push({ slug, reason: "failed to parse front matter" });
      continue;
    }

    // Only update if we have at least one timestamp
    if (timestamps.createdAt === undefined && timestamps.updatedAt === undefined) {
      console.warn(
        `⚠️ No timestamps found in ${slug}/index.md, skipping update`,
      );
      skippedCount++;
      skippedSlugs.push({ slug, reason: "no timestamps in front matter" });
      continue;
    }

    try {
      // Find document by slug
      const querySnapshot = await collection.where("slug", "==", slug).get();

      if (querySnapshot.empty) {
        console.warn(
          `⚠️ No import document found for slug: ${slug}, skipping`,
        );
        skippedCount++;
        skippedSlugs.push({ slug, reason: "no import document found" });
        continue;
      }

      // Update the document with timestamps
      const documentData: Record<string, Timestamp> = {};
      if (timestamps.createdAt) {
        documentData["createdAt"] = timestamps.createdAt;
      }
      if (timestamps.updatedAt) {
        documentData["updatedAt"] = timestamps.updatedAt;
      }

      for (const document of querySnapshot.docs) {
        await document.ref.update(documentData);
        process.stdout.write("."); // progress dot
        successCount++;
      }
    } catch (error) {
      console.error(`\n❌ Error updating ${slug}:`, error);
      errorCount++;
      failedSlugs.push(slug);
    }
  }

  console.log("\n\nSync complete!");
  console.log(`✅ Success: ${successCount}`);
  console.log(`⚠️ Skipped: ${skippedCount}`);
  console.log(`❌ Errors: ${errorCount}`);

  // Output failed slugs for retry capability
  if (failedSlugs.length > 0) {
    console.log("\n📋 Failed slugs (for retry):");
    console.log(JSON.stringify(failedSlugs, undefined, 2));
  }

  // Output detailed skip reasons if any
  if (skippedSlugs.length > 0) {
    console.log("\n📋 Skipped slugs with reasons:");
    for (const { slug, reason } of skippedSlugs) {
      console.log(`  - ${slug}: ${reason}`);
    }
  }
}

await syncProfileTimestamps();
