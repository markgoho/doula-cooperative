#!/usr/bin/env bun
import { Glob } from "bun";

const IMAGEKIT_PUBLIC_KEY = process.env["IMAGEKIT_PUBLIC_KEY"] ?? "";
const IMAGEKIT_PRIVATE_KEY = process.env["IMAGEKIT_PRIVATE_KEY"] ?? "";

if (!IMAGEKIT_PUBLIC_KEY || !IMAGEKIT_PRIVATE_KEY) {
  console.error(
    "Missing IMAGEKIT_PUBLIC_KEY or IMAGEKIT_PRIVATE_KEY. Bun loads these from .env automatically.",
  );
  process.exit(1);
}

// Types
interface MigrationResult {
  slug: string;
  status: "success" | "skipped" | "error";
  reason?: string;
  imagekitPath?: string;
}

// Find source image in profile directory (priority order)
async function findSourceImage(
  profileDirectory: string,
  slug: string,
): Promise<string | undefined> {
  const extensions = ["jpg", "jpeg", "png", "webp"];

  for (const extension of extensions) {
    const imagePath = `${profileDirectory}/${slug}-profile.${extension}`;
    const file = Bun.file(imagePath);
    if (await file.exists()) {
      return imagePath;
    }
  }

  return undefined;
}

// Check if front matter already has imagekit_path
async function hasImagekitPath(markdownPath: string): Promise<boolean> {
  try {
    const content = await Bun.file(markdownPath).text();
    return content.includes("imagekit_path:");
  } catch {
    return false;
  }
}

// Surgically insert imagekit_path into front matter
async function insertImagekitPath(
  markdownPath: string,
  imagekitPath: string,
  dryRun: boolean,
): Promise<void> {
  const content = await Bun.file(markdownPath).text();

  // Find closing --- (skip opening ---)
  const frontMatterEnd = content.indexOf("\n---\n", 4);
  if (frontMatterEnd === -1) {
    throw new Error("No front matter closing --- found");
  }

  // Insert before closing ---
  const beforeClosing = content.slice(0, frontMatterEnd + 1);
  const afterClosing = content.slice(frontMatterEnd + 1);
  const newContent =
    beforeClosing + `imagekit_path: "${imagekitPath}"\n` + afterClosing;

  if (!dryRun) {
    await Bun.write(markdownPath, newContent);
  }
}

// Upload image to ImageKit
async function uploadToImageKit(
  imagePath: string,
  slug: string,
  dryRun: boolean,
): Promise<{ path: string }> {
  const imagekitPath = `/doulas/${slug}/${slug}-profile`;

  if (dryRun) {
    console.log(
      `  [DRY RUN] Would upload ${imagePath} to ImageKit at ${imagekitPath}`,
    );
    return { path: imagekitPath };
  }

  const { default: ImageKitClient } = await import("imagekit");

  const imagekit = new ImageKitClient({
    publicKey: IMAGEKIT_PUBLIC_KEY,
    privateKey: IMAGEKIT_PRIVATE_KEY,
    urlEndpoint: "https://ik.imagekit.io/doulacoop",
  });

  const imageBuffer = await Bun.file(imagePath).arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString("base64");

  const result = await imagekit.upload({
    file: imageBase64,
    fileName: `${slug}-profile`,
    folder: `/doulas/${slug}`,
  });

  return { path: result.filePath };
}

// Process single profile
async function processProfile(
  profileDirectory: string,
  slug: string,
  dryRun: boolean,
): Promise<MigrationResult> {
  console.log(`\nProcessing: ${slug}`);

  const markdownPath = `${profileDirectory}/index.md`;

  // Check if already migrated
  if (await hasImagekitPath(markdownPath)) {
    console.log("  Skipped: Already has imagekit_path");
    return { slug, status: "skipped", reason: "already_migrated" };
  }

  // Find source image
  const imagePath = await findSourceImage(profileDirectory, slug);
  if (!imagePath) {
    console.log("  Skipped: No source image found");
    return { slug, status: "skipped", reason: "no_image" };
  }

  try {
    // Upload to ImageKit
    const { path: imagekitPath } = await uploadToImageKit(
      imagePath,
      slug,
      dryRun,
    );
    console.log(`  Uploaded to ImageKit: ${imagekitPath}`);

    // Insert into front matter
    await insertImagekitPath(markdownPath, imagekitPath, dryRun);
    console.log(`  Updated front matter`);

    return { slug, status: "success", imagekitPath };
  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error(`  Error: ${errorMessage}`);
    return {
      slug,
      status: "error",
      reason: errorMessage,
    };
  }
}

// Main execution
async function main() {
  const dryRun = process.argv.includes("--dry-run");

  console.log("=".repeat(60));
  console.log("ImageKit Migration Script");
  console.log(dryRun ? "[DRY RUN MODE]" : "[LIVE MODE]");
  console.log("=".repeat(60));

  // Scan doulas directory for profile subdirectories
  const doulasDirectory = `${process.cwd()}/hugo/content/doulas`;
  const glob = new Glob("*/index.md");
  const profileSlugs: string[] = [];

  for await (const match of glob.scan(doulasDirectory)) {
    const slug = match.split("/")[0];
    if (slug && slug !== "tag" && !slug.startsWith("_")) {
      profileSlugs.push(slug);
    }
  }

  profileSlugs.sort();

  console.log(`\nFound ${profileSlugs.length} profile directories\n`);

  // Process each profile
  const results: MigrationResult[] = [];
  for (const slug of profileSlugs) {
    const result = await processProfile(
      `${doulasDirectory}/${slug}`,
      slug,
      dryRun,
    );
    results.push(result);
  }

  // Print summary
  console.log("\n" + "=".repeat(60));
  console.log("MIGRATION SUMMARY");
  console.log("=".repeat(60));

  const successful = results.filter(r => r.status === "success");
  const skipped = results.filter(r => r.status === "skipped");
  const errors = results.filter(r => r.status === "error");

  console.log(`\nTotal: ${results.length} profiles`);
  console.log(`  Success: ${successful.length}`);
  console.log(`  Skipped: ${skipped.length}`);
  console.log(`  Errors: ${errors.length}`);

  if (skipped.length > 0) {
    console.log("\nSkipped profiles:");
    for (const result of skipped) {
      console.log(`  - ${result.slug}: ${result.reason}`);
    }
  }

  if (errors.length > 0) {
    console.log("\nFailed profiles:");
    for (const result of errors) {
      console.log(`  - ${result.slug}: ${result.reason}`);
    }
  }

  if (dryRun) {
    console.log(
      "\n[DRY RUN] No changes were made. Run without --dry-run to execute.",
    );
  }

  console.log("\n" + "=".repeat(60));
}

// Run
await main().catch((error: unknown) => {
  const errorMessage = error instanceof Error ? error.message : String(error);
  console.error("Fatal error:", errorMessage);
  process.exit(1);
});
