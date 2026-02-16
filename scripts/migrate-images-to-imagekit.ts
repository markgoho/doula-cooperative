#!/usr/bin/env bun
import { Glob } from "bun";

const IMAGEKIT_PRIVATE_KEY = process.env["IMAGEKIT_PRIVATE_KEY"] ?? "";

if (!IMAGEKIT_PRIVATE_KEY) {
  console.error(
    "Missing IMAGEKIT_PRIVATE_KEY. Bun loads these from .env automatically.",
  );
  process.exit(1);
}

// Types
interface MigrationResult {
  slug: string;
  status: "success" | "skipped" | "error";
  reason?: string;
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

// Upload image to ImageKit with deterministic path (overwrites existing)
async function uploadToImageKit(
  imagePath: string,
  slug: string,
  dryRun: boolean,
): Promise<void> {
  const imagekitPath = `/doulas/${slug}/${slug}-profile`;

  if (dryRun) {
    console.log(
      `  [DRY RUN] Would upload ${imagePath} to ImageKit at ${imagekitPath}`,
    );
    return;
  }

  const { default: ImageKitClient } = await import("@imagekit/nodejs");

  const imagekit = new ImageKitClient({
    privateKey: IMAGEKIT_PRIVATE_KEY,
  });

  const imageBuffer = await Bun.file(imagePath).arrayBuffer();
  const imageBase64 = Buffer.from(imageBuffer).toString("base64");

  await imagekit.files.upload({
    file: imageBase64,
    fileName: `${slug}-profile`,
    folder: `/doulas/${slug}`,
    useUniqueFileName: false, // Deterministic path — no random suffix
  });
}

// Process single profile
async function processProfile(
  profileDirectory: string,
  slug: string,
  dryRun: boolean,
): Promise<MigrationResult> {
  console.log(`\nProcessing: ${slug}`);

  // Find source image
  const imagePath = await findSourceImage(profileDirectory, slug);
  if (!imagePath) {
    console.log("  Skipped: No source image found");
    return { slug, status: "skipped", reason: "no_image" };
  }

  try {
    await uploadToImageKit(imagePath, slug, dryRun);
    console.log(`  Uploaded to ImageKit: /doulas/${slug}/${slug}-profile`);

    return { slug, status: "success" };
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
