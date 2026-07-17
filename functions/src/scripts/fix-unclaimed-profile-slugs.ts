import { getApps, initializeApp } from "firebase-admin/app";
import { FieldValue, getFirestore } from "firebase-admin/firestore";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { IMPORT_COLLECTION } from "../collections/index.js";

const SHOULD_USE_EMULATOR = process.env["USE_EMULATOR"] !== "false";

function parseHugoFrontmatter(filePath: string): { email?: string } {
  try {
    const content = readFileSync(filePath, "utf8");
    // Extract frontmatter between --- markers
    const frontmatterMatch = /^---\n([\s\S]*?)\n---/.exec(content);
    if (!frontmatterMatch?.[1]) return {};

    const frontmatter = frontmatterMatch[1];
    // Look for email in contact section: email: "email@example.com"
    const emailMatch = /email:\s*["']?([^\s"']+)["']?/.exec(frontmatter);
    if (emailMatch?.[1]) {
      return { email: emailMatch[1] };
    }
    return {};
  } catch {
    return {};
  }
}

async function fixUnclaimedProfileSlugs() {
  // 1. Setup Emulator / Firebase
  if (SHOULD_USE_EMULATOR) {
    process.env["FIRESTORE_EMULATOR_HOST"] = "localhost:8090";
    process.env["GCLOUD_PROJECT"] = "doula-cooperative";
    console.log("🔧 Using Firebase Firestore Emulator at localhost:8090");
  } else {
    console.log("⚠️  Running against PRODUCTION database");
  }

  if (getApps().length === 0) {
    initializeApp({
      projectId: "doula-cooperative",
    });
  }

  const database = getFirestore();
  const collection = database.collection(IMPORT_COLLECTION);

  // 2. Get valid Hugo doula slugs and build email->slug mapping
  const doulaContentPath = path.join(process.cwd(), "../hugo/content/doulas");
  console.log(`Reading doula profiles from: ${doulaContentPath}`);

  const validSlugs = new Set<string>();
  const emailToSlug = new Map<string, string>();
  const entries = readdirSync(doulaContentPath);

  for (const entry of entries) {
    const fullPath = path.join(doulaContentPath, entry);
    const stat = statSync(fullPath);

    // Only include directories (exclude _index.md and tag directory)
    if (entry !== "tag" && stat.isDirectory()) {
      validSlugs.add(entry);

      // Try to parse email from index.md
      const indexPath = path.join(fullPath, "index.md");
      const { email } = parseHugoFrontmatter(indexPath);
      if (email) {
        emailToSlug.set(email.toLowerCase(), entry);
      }
    }
  }

  console.log(`Found ${validSlugs.size} valid doula profile slugs in Hugo`);
  console.log(
    `Found ${emailToSlug.size} doula profiles with email addresses\n`,
  );

  // 3. Fetch all UnclaimedProfile documents
  const snapshot = await collection.get();
  console.log(`Found ${snapshot.size} documents in ${IMPORT_COLLECTION}\n`);

  let totalDocuments = 0;
  let validSlugCount = 0;
  let noSlugCount = 0;

  const documentsToRemoveSlug: {
    email: string;
    name: string;
    currentSlug: string;
  }[] = [];

  const documentsToSetSlug: {
    email: string;
    name: string;
    currentSlug: string | undefined;
    newSlug: string;
  }[] = [];

  // 4. Analyze documents - prioritize email matching
  console.log("Analyzing documents...\n");
  for (const document of snapshot.docs) {
    totalDocuments++;
    const data = document.data();
    const email = document.id;
    const name = data["name"] as string;
    const slug = data["slug"] as string | undefined;

    // First, check if email matches a Hugo profile
    const matchedSlugByEmail = emailToSlug.get(email.toLowerCase());

    if (matchedSlugByEmail) {
      // Email matches a Hugo profile
      if (slug === matchedSlugByEmail) {
        // Slug is already correct
        validSlugCount++;
        console.log(
          `  ✅ ${email} (${name}): Valid slug "${slug}" (email match)`,
        );
      } else {
        // Need to update slug to match email
        if (slug) {
          console.log(
            `  🔄 ${email} (${name}): Update slug "${slug}" → "${matchedSlugByEmail}" (email match)`,
          );
        } else {
          console.log(
            `  ➕ ${email} (${name}): Add slug "${matchedSlugByEmail}" (email match)`,
          );
        }
        documentsToSetSlug.push({
          email,
          name,
          currentSlug: slug,
          newSlug: matchedSlugByEmail,
        });
      }
    } else {
      // No email match - fall back to slug validation
      if (!slug) {
        noSlugCount++;
        console.log(`  ⚪ ${email} (${name}): No slug, no email match`);
      } else if (validSlugs.has(slug)) {
        validSlugCount++;
        console.log(
          `  ✅ ${email} (${name}): Valid slug "${slug}" (no email in Hugo)`,
        );
      } else {
        console.log(
          `  ❌ ${email} (${name}): Invalid slug "${slug}", no email match`,
        );
        documentsToRemoveSlug.push({ email, name, currentSlug: slug });
      }
    }
  }

  // 5. Summary and confirmation
  console.log("\n" + "=".repeat(60));
  console.log("SUMMARY");
  console.log("=".repeat(60));
  console.log(`Total documents: ${totalDocuments}`);
  console.log(`Valid slugs (already correct): ${validSlugCount}`);
  console.log(
    `Slugs to set/update (email match): ${documentsToSetSlug.length}`,
  );
  console.log(`Invalid slugs to remove: ${documentsToRemoveSlug.length}`);
  console.log(`No slug, no email match: ${noSlugCount}`);
  console.log("=".repeat(60) + "\n");

  const totalUpdates = documentsToSetSlug.length + documentsToRemoveSlug.length;

  if (totalUpdates === 0) {
    console.log("✅ All slugs are correct. Nothing to update!");
    return;
  }

  if (documentsToSetSlug.length > 0) {
    console.log(
      `Will set/update slug field for ${documentsToSetSlug.length} documents:\n`,
    );
    for (const document of documentsToSetSlug) {
      if (document.currentSlug) {
        console.log(
          `  - ${document.email} (${document.name}): "${document.currentSlug}" → "${document.newSlug}"`,
        );
      } else {
        console.log(
          `  - ${document.email} (${document.name}): Add "${document.newSlug}"`,
        );
      }
    }
    console.log("");
  }

  if (documentsToRemoveSlug.length > 0) {
    console.log(
      `Will remove slug field from ${documentsToRemoveSlug.length} documents:\n`,
    );
    for (const document of documentsToRemoveSlug) {
      console.log(
        `  - ${document.email} (${document.name}): Remove "${document.currentSlug}"`,
      );
    }
    console.log("");
  }

  // 6. Apply updates
  console.log("🔄 Updating documents...\n");
  let successCount = 0;
  let errorCount = 0;

  // First, set/update slugs based on email matches
  for (const document of documentsToSetSlug) {
    try {
      await collection.doc(document.email).update({
        slug: document.newSlug,
      });
      if (document.currentSlug) {
        console.log(
          `  ✅ Updated slug for ${document.email}: "${document.currentSlug}" → "${document.newSlug}"`,
        );
      } else {
        console.log(
          `  ✅ Added slug for ${document.email}: "${document.newSlug}"`,
        );
      }
      successCount++;
    } catch (error) {
      console.error(`  ❌ Error updating ${document.email}:`, error);
      errorCount++;
    }
  }

  // Then, remove invalid slugs
  for (const document of documentsToRemoveSlug) {
    try {
      await collection.doc(document.email).update({
        slug: FieldValue.delete(),
      });
      console.log(`  ✅ Removed slug from ${document.email}`);
      successCount++;
    } catch (error) {
      console.error(`  ❌ Error updating ${document.email}:`, error);
      errorCount++;
    }
  }

  // 7. Final summary
  console.log("\n" + "=".repeat(60));
  console.log("FINAL RESULTS");
  console.log("=".repeat(60));
  console.log(`✅ Successfully updated: ${successCount}`);
  console.log(`❌ Errors: ${errorCount}`);
  console.log("=".repeat(60));
}

await fixUnclaimedProfileSlugs();
