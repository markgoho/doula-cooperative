/**
 * One-time migration script: Seed the `profiles` Firestore collection
 * from existing Hugo markdown files.
 *
 * Parses YAML front matter + markdown body from each profile directory,
 * looks up the ownerUid from member documents, and writes to `profiles/{slug}`.
 *
 * Usage:
 *   bun scripts/migrate-profiles-to-firestore.ts
 *
 * Requires:
 *   - FIREBASE_SERVICE_ACCOUNT env var (JSON string) or Application Default Credentials
 *   - Read access to hugo/content/doulas/
 *   - Write access to Firestore `profiles` collection
 */

import { YAML } from "bun";
import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

const PROFILES_COLLECTION = "profiles";
const MEMBERS_COLLECTION = "members";

const HUGO_DOULAS_DIR = resolve(
  import.meta.dirname ?? ".",
  "../hugo/content/doulas",
);

/** Directories/files to skip when scanning for profiles. */
const SKIP_ENTRIES = new Set(["tag", "_index.md"]);

interface Contact {
  phone?: string;
  email?: string;
  website?: string;
  business_name?: string;
}

interface HugoFrontMatter {
  title?: string;
  type?: string;
  credentials?: string;
  pronouns?: string;
  tags?: string[];
  contact?: Contact;
  draft?: boolean;
  image?: string;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
}

interface ProfileDocument {
  title: string;
  bio: string;
  credentials?: string;
  pronouns?: string;
  tags?: string[];
  contact?: Contact;
  draft: boolean;
  createdAt: string;
  updatedAt: string;
  ownerUid?: string;
}

function parseMarkdownProfile(
  filePath: string,
): { frontMatter: HugoFrontMatter; bio: string } | undefined {
  const content = readFileSync(filePath, "utf8");

  const match = /^---\n([\s\S]*?)\n---\n*([\s\S]*)$/.exec(content);
  if (!match?.[1]) {
    console.warn(`  Warning: No front matter found in ${filePath}`);
    return undefined;
  }

  const frontMatter = YAML.parse(match[1]) as HugoFrontMatter;
  const bio = (match[2] ?? "").trim();

  return { frontMatter, bio };
}

function initFirebase(): void {
  if (getApps().length > 0) {
    return;
  }

  const serviceAccountJson = process.env["FIREBASE_SERVICE_ACCOUNT"];
  if (serviceAccountJson) {
    const serviceAccount = JSON.parse(serviceAccountJson);
    initializeApp({ credential: cert(serviceAccount) });
  } else {
    initializeApp({
      projectId: "doula-cooperative",
    });
  }
}

async function lookupOwnerUid(
  firestore: FirebaseFirestore.Firestore,
  slug: string,
): Promise<string | undefined> {
  const query = firestore
    .collection(MEMBERS_COLLECTION)
    .where("slug", "==", slug)
    .limit(1);

  const snapshot = await query.get();
  if (snapshot.empty) {
    return undefined;
  }

  const document = snapshot.docs[0];
  return document?.id;
}

async function migrateProfiles(): Promise<void> {
  console.log("Migrating Hugo profiles to Firestore...");

  if (!existsSync(HUGO_DOULAS_DIR)) {
    console.error(`Hugo doulas directory not found: ${HUGO_DOULAS_DIR}`);
    process.exit(1);
  }

  initFirebase();
  const firestore = getFirestore();

  const entries = readdirSync(HUGO_DOULAS_DIR, { withFileTypes: true });
  const profileDirs = entries.filter(
    entry => entry.isDirectory() && !SKIP_ENTRIES.has(entry.name),
  );

  console.log(`Found ${profileDirs.length} profile directories`);

  let migratedCount = 0;
  let skippedCount = 0;
  let errorCount = 0;

  for (const dir of profileDirs) {
    const slug = dir.name;
    const indexPath = join(HUGO_DOULAS_DIR, slug, "index.md");

    if (!existsSync(indexPath)) {
      console.log(`  Skipping ${slug}/ (no index.md)`);
      skippedCount++;
      continue;
    }

    try {
      const parsed = parseMarkdownProfile(indexPath);
      if (!parsed) {
        skippedCount++;
        continue;
      }

      const { frontMatter, bio } = parsed;

      if (!frontMatter.title) {
        console.warn(`  Skipping ${slug}/ (no title in front matter)`);
        skippedCount++;
        continue;
      }

      // Look up owner UID from members collection
      const ownerUid = await lookupOwnerUid(firestore, slug);

      const now = new Date().toISOString();
      const profileDoc: ProfileDocument = {
        title: frontMatter.title,
        bio,
        draft: frontMatter.draft ?? true,
        createdAt: frontMatter.createdAt ?? now,
        updatedAt: frontMatter.updatedAt ?? now,
      };

      if (frontMatter.credentials) {
        profileDoc.credentials = frontMatter.credentials;
      }
      if (frontMatter.pronouns) {
        profileDoc.pronouns = frontMatter.pronouns;
      }
      if (frontMatter.tags && frontMatter.tags.length > 0) {
        profileDoc.tags = frontMatter.tags;
      }
      if (frontMatter.contact) {
        profileDoc.contact = frontMatter.contact;
      }
      if (ownerUid) {
        profileDoc.ownerUid = ownerUid;
      }

      // Use set with merge for idempotency
      await firestore
        .collection(PROFILES_COLLECTION)
        .doc(slug)
        .set(profileDoc, { merge: true });

      console.log(`  Migrated ${slug} (owner: ${ownerUid ?? "none"})`);
      migratedCount++;
    } catch (error: unknown) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error(`  Error migrating ${slug}: ${errorMessage}`);
      errorCount++;
    }
  }

  console.log(
    `\nMigration complete: ${migratedCount} migrated, ${skippedCount} skipped, ${errorCount} errors`,
  );

  if (errorCount > 0) {
    process.exit(1);
  }
}

migrateProfiles().catch((error: unknown) => {
  console.error("Migration failed:", error);
  process.exit(1);
});
