import { access, readdir, stat } from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

interface ImageFile {
  path: string;
  name: string;
  extension: string;
}

// Parse command line arguments
const forceFlag = process.argv.includes("--force");

async function findProfileImages(
  doulasDirectory: string,
): Promise<ImageFile[]> {
  const images: ImageFile[] = [];

  try {
    const doulaDirectories = await readdir(doulasDirectory);

    for (const doulaDirectory of doulaDirectories) {
      const doulaPath = path.join(doulasDirectory, doulaDirectory);
      const stats = await stat(doulaPath);

      if (stats.isDirectory()) {
        const files = await readdir(doulaPath);

        for (const file of files) {
          const extension = path.extname(file).toLowerCase();
          if (
            (extension === ".jpg" ||
              extension === ".jpeg" ||
              extension === ".png" ||
              extension === ".webp") &&
            file.includes("profile")
          ) {
            images.push({
              path: path.join(doulaPath, file),
              name: path.basename(file, extension),
              extension,
            });
          }
        }
      }
    }

    return images;
  } catch (error) {
    console.error("Error reading doula directories:", error);
    return [];
  }
}

async function convertToAvif(image: ImageFile) {
  const baseName = image.path.replace(image.extension, "");
  const avifPath1200 = `${baseName}-1200.avif`;
  const avifPath600 = `${baseName}-600.avif`;
  const avifPath300 = `${baseName}-300.avif`;

  // Check which AVIF files already exist
  const filesToCheck = [avifPath1200, avifPath600, avifPath300];
  const existingFiles = [];
  const missingFiles = [];

  for (const filePath of filesToCheck) {
    try {
      await access(filePath);
      existingFiles.push(filePath);
    } catch {
      // File doesn't exist, will be created
      missingFiles.push(filePath);
    }
  }

  if (existingFiles.length > 0 && !forceFlag) {
    console.log(
      `Skipped existing files: ${existingFiles.join(", ")} (use --force to overwrite)`,
    );
  }

  if (missingFiles.length === 0 && !forceFlag) {
    console.log(`All AVIF files already exist for ${image.path}`);
    return;
  }

  try {
    // Create 1200px version if it doesn't exist or force flag is used
    if (missingFiles.includes(avifPath1200) || forceFlag) {
      await sharp(image.path)
        .resize(1200, 1200, { fit: "inside" }) // Maintains aspect ratio, max 1200px
        .avif({ quality: 50 })
        .toFile(avifPath1200);
      console.log(`Created: ${avifPath1200}`);
    }

    // Create 600px version if it doesn't exist or force flag is used
    if (missingFiles.includes(avifPath600) || forceFlag) {
      await sharp(image.path)
        .resize(600, 600, { fit: "inside" }) // Maintains aspect ratio, max 600px
        .avif({ quality: 50 })
        .toFile(avifPath600);
      console.log(`Created: ${avifPath600}`);
    }

    // Create 300px version if it doesn't exist or force flag is used
    if (missingFiles.includes(avifPath300) || forceFlag) {
      await sharp(image.path)
        .resize(300, 300, { fit: "inside" }) // Maintains aspect ratio, max 300px
        .avif({ quality: 50 })
        .toFile(avifPath300);
      console.log(`Created: ${avifPath300}`);
    }

    console.log(`Conversion complete for: ${image.path}`);
  } catch (error) {
    console.error(`Failed to convert ${image.path}:`, error);
  }
}

// Top-level await block
const doulasDirectory = "hugo/content/doulas";
const images = await findProfileImages(doulasDirectory);

if (images.length === 0) {
  console.log("No profile images found.");
} else {
  console.log(
    `Found ${images.length.toString()} profile images.${forceFlag ? " Force mode enabled." : ""}`,
  );
  for (const image of images) {
    await convertToAvif(image);
  }
  console.log(`Conversion complete.`);
}
