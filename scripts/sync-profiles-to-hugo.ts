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
 *   - FIREBASE_SERVICE_ACCOUNT env var (JSON string) or Application Default Credentials
 *   - Write access to hugo/content/doulas/
 */

import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";

const PROFILES_COLLECTION = "profiles";

const HUGO_DOULAS_DIR = path.resolve(
  import.meta.dirname,
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
  imageUpdatedAt?: string;
  ownerUid?: string;
}

interface HugoFrontMatter {
  title: string;
  type: string;
  updatedAt?: string;
  imageUpdatedAt?: string;
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

/**
 * Quote a YAML scalar value if it contains characters that would
 * break block-style YAML parsing (colons, hash signs, etc.).
 */
function yamlScalar(value: string | boolean | number): string {
  if (typeof value !== "string") {
    return String(value);
  }
  if (value === "" || /[:#[\]{}|>&*!]/.test(value)) {
    return `"${value.replaceAll('"', String.raw`\"`)}"`;
  }
  return value;
}

/**
 * Serialize a HugoFrontMatter object to block-style YAML.
 * Handles the known frontmatter shape: scalar fields, one string array (tags),
 * and one shallow object (contact). No general-purpose YAML library needed.
 */
function serializeFrontMatter(frontMatter: HugoFrontMatter): string {
  const lines: string[] = [];

  for (const [key, value] of Object.entries(frontMatter) as [
    string,
    string | number | boolean | string[] | Contact | undefined,
  ][]) {
    if (value === undefined) {
      continue;
    }

    if (Array.isArray(value)) {
      lines.push(`${key}:`);
      for (const item of value) {
        lines.push(`  - ${yamlScalar(item)}`);
      }
    } else if (typeof value === "object") {
      lines.push(`${key}:`);
      for (const [nestedKey, nestedValue] of Object.entries(
        value as Record<string, string>,
      )) {
        lines.push(`  ${nestedKey}: ${yamlScalar(nestedValue)}`);
      }
    } else {
      lines.push(`${key}: ${yamlScalar(value)}`);
    }
  }

  return lines.join("\n");
}

function serializeProfileToMarkdown(
  slug: string,
  profile: ProfileDocument,
): string {
  const frontMatter: HugoFrontMatter = {
    title: profile.title,
    type: "doulas",
  };

  if (profile.updatedAt) {
    frontMatter.updatedAt = profile.updatedAt;
  }

  // Versions the public ImageKit URL so a replaced photo is fetched again
  // instead of being served from a year-long cache under the same URL.
  if (profile.imageUpdatedAt) {
    frontMatter.imageUpdatedAt = profile.imageUpdatedAt;
  }

  if (profile.createdAt) {
    const [dateOnly] = profile.createdAt.split("T", 1);
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

  const yamlFrontMatter = serializeFrontMatter(frontMatter);
  const bio = profile.bio.trim();

  return `---\n${yamlFrontMatter}\n---\n\n${bio}\n`;
}

function initFirebase(): void {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(
      serviceAccountJson,
    ) as import("firebase-admin").ServiceAccount;
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp({
      projectId: "doula-cooperative",
    });
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
    throw new Error(
      "ABORTING: Firestore returned 0 profiles. " +
        "This would delete all existing profile directories. " +
        "Check FIREBASE_SERVICE_ACCOUNT and Firestore project configuration.",
    );
  }

  const firestoreSlugs = new Set<string>();
  const errors: { slug: string; error: string }[] = [];

  // Write each profile to Hugo content
  for (const document of snapshot.docs) {
    const slug = document.id;
    firestoreSlugs.add(slug);

    try {
      const profile = document.data() as ProfileDocument;
      const profileDirectory = path.join(HUGO_DOULAS_DIR, slug);
      const profilePath = path.join(profileDirectory, "index.md");

      // Ensure directory exists
      if (!existsSync(profileDirectory)) {
        mkdirSync(profileDirectory, { recursive: true });
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
      const directoryPath = path.join(HUGO_DOULAS_DIR, entry.name);
      rmSync(directoryPath, { recursive: true, force: true });
      console.log(`  Deleted ${entry.name}/ (not in Firestore)`);
      deletedCount++;
    }
  }

  console.log(
    `Sync complete: ${snapshot.size} profiles written, ${deletedCount} stale directories removed`,
  );

  if (errors.length > 0) {
    throw new Error(
      `${errors.length} profile(s) failed to sync:\n` +
        errors.map(entry => `  ${entry.slug}: ${entry.error}`).join("\n"),
    );
  }
}

await syncProfiles();
