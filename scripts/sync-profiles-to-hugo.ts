/**
 * Pre-build script: Sync Firestore profiles to Hugo markdown files.
 *
 * Runs before `hugo` in CI. Queries the `profiles` Firestore collection
 * and writes markdown files to `hugo/content/doulas/{slug}/index.md`.
 *
 * Usage:
 *   bun scripts/sync-profiles-to-hugo.ts
 *
 * Requires:
 *   - GOOGLE_APPLICATION_CREDENTIALS or Application Default Credentials
 *   - Write access to hugo/content/doulas/
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { dump } from "js-yaml";
import { existsSync, mkdirSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PROFILES_COLLECTION = "profiles";
const IMAGEKIT_BASE_URL = "https://ik.imagekit.io/doulacoop";

const HUGO_DOULAS_DIR = resolve(
  import.meta.dirname ?? ".",
  "../hugo/content/doulas",
);

/** Directories that should never be deleted during sync. */
const PRESERVED_DIRS = new Set(["tag"]);
/** Files at the doulas root level that should never be deleted. */
const PRESERVED_FILES = new Set(["_index.md"]);

interface Contact {
  phone?: string;
  email?: string;
  website?: string;
  business_name?: string;
}

interface ProfileDocument {
  title: string;
  bio: string;
  credentials?: string;
  pronouns?: string;
  tags?: string[];
  contact?: Contact;
  draft?: boolean;
  image?: string;
  createdAt?: string;
  updatedAt?: string;
  ownerUid?: string;
}

interface HugoFrontMatter {
  title: string;
  type: string;
  updatedAt?: string;
  date?: string;
  createdAt?: string;
  draft?: boolean;
  credentials?: string;
  pronouns?: string;
  tags?: string[];
  contact?: Contact;
}

function stripUrlProtocol(url: string): string {
  return url.replace(/^https?:\/\//, "");
}

function serializeProfileToMarkdown(slug: string, profile: ProfileDocument): string {
  const frontMatter: HugoFrontMatter = {
    title: profile.title,
    type: "doulas",
  };

  if (profile.updatedAt) {
    frontMatter.updatedAt = profile.updatedAt;
  }

  if (profile.createdAt) {
    const [dateOnly] = profile.createdAt.split("T");
    frontMatter.date = dateOnly ?? profile.createdAt;
    frontMatter.createdAt = profile.createdAt;
  }

  if (profile.draft !== undefined) {
    frontMatter.draft = profile.draft;
  }

  if (profile.credentials) {
    frontMatter.credentials = profile.credentials;
  }

  if (profile.pronouns) {
    frontMatter.pronouns = profile.pronouns;
  }

  if (profile.tags && profile.tags.length > 0) {
    frontMatter.tags = profile.tags;
  }

  if (profile.contact) {
    const contact: Contact = {};
    if (profile.contact.business_name) {
      contact.business_name = profile.contact.business_name;
    }
    if (profile.contact.website) {
      contact.website = stripUrlProtocol(profile.contact.website);
    }
    if (profile.contact.phone) {
      contact.phone = profile.contact.phone;
    }
    if (profile.contact.email) {
      contact.email = profile.contact.email;
    }
    if (Object.keys(contact).length > 0) {
      frontMatter.contact = contact;
    }
  }

  let yamlFrontMatter = dump(frontMatter, {
    lineWidth: -1,
    noRefs: true,
  }).trim();

  // js-yaml quotes date-like strings; Hugo expects unquoted YYYY-MM-DD for `date`
  if (frontMatter.date) {
    yamlFrontMatter = yamlFrontMatter.replace(/^date: '(.+)'$/m, "date: $1");
  }

  const bio = profile.bio?.trim() ?? "";

  return `---\n${yamlFrontMatter}\n---\n\n${bio}\n`;
}

function initFirebase(): void {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccountPath = process.env["GOOGLE_APPLICATION_CREDENTIALS"];
  if (serviceAccountPath) {
    initializeApp({
      credential: cert(serviceAccountPath),
    });
  } else {
    // Use Application Default Credentials (works in CI with gcloud auth)
    initializeApp();
  }
}

async function syncProfiles(): Promise<void> {
  console.log("Syncing profiles from Firestore to Hugo...");

  initFirebase();
  const firestore = getFirestore();

  // Fetch all profiles from Firestore
  const snapshot = await firestore.collection(PROFILES_COLLECTION).get();
  console.log(`Found ${snapshot.size} profiles in Firestore`);

  // Safety check: abort if Firestore returns 0 profiles.
  // This prevents wiping all Hugo profile directories due to
  // misconfigured credentials, wrong project, or transient Firestore outage.
  if (snapshot.empty) {
    console.error(
      "ABORTING: Firestore returned 0 profiles. " +
        "This would delete all existing profile directories. " +
        "Check GOOGLE_APPLICATION_CREDENTIALS and Firestore project configuration.",
    );
    process.exit(1);
  }

  const firestoreSlugs = new Set<string>();
  const errors: Array<{ slug: string; error: string }> = [];

  // Write each profile to Hugo content
  for (const document of snapshot.docs) {
    const slug = document.id;
    firestoreSlugs.add(slug);

    try {
      const profile = document.data() as ProfileDocument;
      const profileDir = join(HUGO_DOULAS_DIR, slug);
      const profilePath = join(profileDir, "index.md");

      // Ensure directory exists
      if (!existsSync(profileDir)) {
        mkdirSync(profileDir, { recursive: true });
      }

      const markdown = serializeProfileToMarkdown(slug, profile);
      writeFileSync(profilePath, markdown, "utf8");
      console.log(`  Wrote ${slug}/index.md`);
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`  ERROR writing ${slug}: ${errorMessage}`);
      errors.push({ slug, error: errorMessage });
    }
  }

  // Delete profile directories that no longer exist in Firestore
  if (!existsSync(HUGO_DOULAS_DIR)) {
    console.log("Hugo doulas directory does not exist, skipping cleanup");
    return;
  }

  const entries = readdirSync(HUGO_DOULAS_DIR, { withFileTypes: true });
  let deletedCount = 0;

  for (const entry of entries) {
    // Skip preserved entries
    if (PRESERVED_DIRS.has(entry.name) || PRESERVED_FILES.has(entry.name)) {
      continue;
    }

    // Only consider directories (each profile is a directory)
    if (!entry.isDirectory()) {
      continue;
    }

    // Delete if not in Firestore
    if (!firestoreSlugs.has(entry.name)) {
      const dirPath = join(HUGO_DOULAS_DIR, entry.name);
      rmSync(dirPath, { recursive: true, force: true });
      console.log(`  Deleted ${entry.name}/ (not in Firestore)`);
      deletedCount++;
    }
  }

  console.log(
    `Sync complete: ${snapshot.size} profiles written, ${deletedCount} stale directories removed`,
  );

  if (errors.length > 0) {
    console.error(
      `\n${errors.length} profile(s) failed to sync:`,
      errors.map((e) => `  ${e.slug}: ${e.error}`).join("\n"),
    );
    process.exit(1);
  }
}

syncProfiles().catch((error: unknown) => {
  console.error("Failed to sync profiles:", error);
  process.exit(1);
});
