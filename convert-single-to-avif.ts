import { access } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

// Parse command line arguments
const forceFlag = process.argv.includes("--force");
const filePath = process.argv.find(
  argument =>
    !argument.startsWith("--") &&
    argument !== process.argv[0] &&
    argument !== process.argv[1],
);

if (!filePath) {
  console.error("Usage: bun convert-single-to-avif.ts <file-path> [--force]");
  console.error("Example: bun convert-single-to-avif.ts image.jpg");
  console.error("Example: bun convert-single-to-avif.ts image.jpg --force");
  throw new Error("No file path provided");
}

async function convertToAvif(inputPath: string) {
  // Check if input file exists
  try {
    await access(inputPath);
  } catch {
    console.error(`Error: File '${inputPath}' does not exist.`);
    throw new Error(`File '${inputPath}' does not exist.`);
  }

  const extension = path.extname(inputPath).toLowerCase();
  const supportedExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".webp",
    ".bmp",
    ".tiff",
    ".tif",
  ];

  if (!supportedExtensions.includes(extension)) {
    console.error(
      `Error: Unsupported file format '${extension}'. Supported formats: ${supportedExtensions.join(", ")}`,
    );
    throw new Error(
      `Unsupported file format '${extension}'. Supported formats: ${supportedExtensions.join(", ")}`,
    );
  }

  const baseName = inputPath.replace(extension, "");
  const avifPath = `${baseName}.avif`;

  // Check if AVIF file already exists
  try {
    await access(avifPath);
    if (!forceFlag) {
      console.log(
        `Skipped: ${avifPath} (already exists, use --force to overwrite)`,
      );
      return;
    }
  } catch {
    // File doesn't exist, will be created
  }

  try {
    // Convert to AVIF without resizing or cropping
    await sharp(inputPath).avif({ quality: 50 }).toFile(avifPath);

    console.log(`Converted: ${inputPath} → ${avifPath}`);
  } catch (error) {
    console.error(`Failed to convert ${inputPath}:`, error);
    throw new Error(`Failed to convert ${inputPath}: ${error}`);
  }
}

// Convert the file
await convertToAvif(filePath);
console.log("Conversion complete.");
