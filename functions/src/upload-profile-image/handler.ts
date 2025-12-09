import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { App } from "octokit";
import sharp from "sharp";
import { MEMBERS_COLLECTION } from "../collections/index.js";
import { ERROR_IDS } from "../constants/error-ids.js";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../constants/github-config.js";
import { type CropData, validateCropData } from "../types/crop-data.js";
import { type MemberDocument } from "../types/member-document.js";
import {
  batchOperateFiles,
  type FileOperation,
} from "../utils/github-batch-operations.js";
import { isGitHubError } from "../utils/github-error.js";

export interface UploadProfileImageRequest {
  /** Base64-encoded image data (with or without data URL prefix) */
  imageData: string;
  /** MIME type of the image */
  mimeType: string;
  /** Crop coordinates */
  cropData: CropData;
}

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const OUTPUT_SIZE = 1200; // Max dimension for output image
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp"];
const AVIF_SIZES = [1200, 600, 300] as const;
const AVIF_QUALITY = 50;

interface AvifVariant {
  filename: string;
  buffer: Buffer;
  size: number;
}

/**
 * Applies crop and resize to image using sharp.
 * Returns a raw buffer of the cropped, square image at 1200x1200.
 * This buffer can then be used to generate JPEG and AVIF variants.
 */
async function cropAndResizeImage(
  imageBuffer: Buffer,
  cropData: CropData,
): Promise<Buffer> {
  // Get image metadata
  const metadata = await sharp(imageBuffer).metadata();
  const { width, height } = metadata;

  if (!width || !height) {
    throw new Error("Could not determine image dimensions");
  }

  // Calculate the visible area size based on zoom
  // At zoom 1.0, the entire image is visible
  // At zoom 2.0, only half the image is visible
  const visibleWidth = width / cropData.zoom;
  const visibleHeight = height / cropData.zoom;

  // The crop size is the smaller of the visible dimensions (to make a square)
  const cropSize = Math.min(visibleWidth, visibleHeight);

  // Calculate crop position
  // x and y are 0-1 representing the center position
  const centerX = cropData.x * width;
  const centerY = cropData.y * height;

  // Calculate top-left of crop region
  let left = Math.round(centerX - cropSize / 2);
  let top = Math.round(centerY - cropSize / 2);

  // Clamp to image bounds
  left = Math.max(0, Math.min(left, width - cropSize));
  top = Math.max(0, Math.min(top, height - cropSize));

  const size = Math.round(cropSize);

  // Crop to square and resize to output size (1200x1200)
  // Return raw buffer for further processing
  return sharp(imageBuffer)
    .extract({
      left: Math.round(left),
      top: Math.round(top),
      width: size,
      height: size,
    })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover" })
    .toBuffer();
}

/**
 * Converts a processed image buffer to JPEG format.
 */
async function convertToJpeg(processedBuffer: Buffer): Promise<Buffer> {
  return sharp(processedBuffer).jpeg({ quality: 90 }).toBuffer();
}

/**
 * Generates AVIF variants at multiple sizes from a processed image buffer.
 * Returns an array of AVIF variants with filenames and buffers.
 *
 * @throws Error if any variant fails to generate (all-or-nothing)
 */
async function generateAvifVariants(
  processedBuffer: Buffer,
  slug: string,
): Promise<AvifVariant[]> {
  const variants: AvifVariant[] = [];

  try {
    for (const size of AVIF_SIZES) {
      const buffer = await sharp(processedBuffer)
        .resize(size, size, { fit: "inside" })
        .avif({ quality: AVIF_QUALITY })
        .toBuffer();

      variants.push({
        filename: `${slug}-profile-${size}.avif`,
        buffer,
        size,
      });
    }

    logger.info(`Generated ${variants.length} AVIF variants for ${slug}`, {
      sizes: AVIF_SIZES,
    });

    return variants;
  } catch (error) {
    logger.error("Failed to generate AVIF variants", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_AVIF_GENERATION_FAILED,
      slug,
      error,
    });
    throw new Error(
      `Failed to generate AVIF variants: ${error instanceof Error ? error.message : String(error)}`,
    );
  }
}

export async function handler(
  request: CallableRequest<UploadProfileImageRequest>,
  [GITHUB_APP_ID, GITHUB_PRIVATE_KEY, GITHUB_INSTALLATION_ID]: [
    string,
    string,
    string,
  ],
) {
  // 1. Validate authentication
  if (!request.auth) {
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated.",
    );
  }

  const uid = request.auth.uid;
  logger.info(`Profile image upload initiated for user: ${uid}`);

  // 2. Validate input data
  const { imageData, mimeType, cropData } = request.data;

  if (!imageData || typeof imageData !== "string") {
    logger.warn("Missing or invalid image data", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_INVALID_DATA,
      uid,
    });
    throw new HttpsError("invalid-argument", "Image data is required.");
  }

  if (!mimeType || !ALLOWED_MIME_TYPES.includes(mimeType)) {
    logger.warn("Invalid MIME type", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_INVALID_DATA,
      uid,
      mimeType,
    });
    throw new HttpsError(
      "invalid-argument",
      `Invalid image type. Allowed types: ${ALLOWED_MIME_TYPES.join(", ")}`,
    );
  }

  if (!validateCropData(cropData)) {
    logger.warn("Invalid crop data", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_INVALID_DATA,
      uid,
      cropData,
    });
    throw new HttpsError(
      "invalid-argument",
      "Invalid crop data. Ensure x, y are 0-1 and zoom is >= 1.",
    );
  }

  // 3. Decode base64 image
  const base64Content = imageData.replace(/^data:image\/\w+;base64,/, "");
  const imageBuffer = Buffer.from(base64Content, "base64");

  // 4. Validate image size
  if (imageBuffer.length > MAX_IMAGE_SIZE) {
    logger.warn("Image too large", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_TOO_LARGE,
      uid,
      size: imageBuffer.length,
    });
    throw new HttpsError(
      "invalid-argument",
      `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
    );
  }

  // 5. Get member document and verify membership
  let memberDocument;
  try {
    const database = getFirestore();
    const memberReference = database.collection(MEMBERS_COLLECTION).doc(uid);
    memberDocument = await memberReference.get();
  } catch (error) {
    logger.error("Failed to read member document", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_PROCESSING_FAILED,
      uid,
      error,
    });
    throw new HttpsError(
      "unavailable",
      "Unable to verify membership. Please try again.",
    );
  }

  if (!memberDocument.exists) {
    throw new HttpsError(
      "not-found",
      "No member document found for this user.",
    );
  }

  const memberData = memberDocument.data() as MemberDocument | undefined;
  if (!memberData) {
    throw new HttpsError("not-found", "Member document data is empty.");
  }

  if (!memberData.membershipActive) {
    throw new HttpsError(
      "failed-precondition",
      "User does not have an active membership.",
    );
  }

  const slug = memberData.slug;
  if (!slug) {
    throw new HttpsError(
      "failed-precondition",
      "Profile slug is required. Please set up your profile first.",
    );
  }

  // 6. Process image (crop and resize)
  let processedBuffer: Buffer;
  let jpegBuffer: Buffer;
  let avifVariants: AvifVariant[];

  try {
    // Crop and resize to 1200x1200 square
    processedBuffer = await cropAndResizeImage(imageBuffer, cropData);

    // Generate JPEG
    jpegBuffer = await convertToJpeg(processedBuffer);

    // Generate AVIF variants
    avifVariants = await generateAvifVariants(processedBuffer, slug);

    logger.info(`Images processed successfully for ${slug}`, {
      originalSize: imageBuffer.length,
      jpegSize: jpegBuffer.length,
      avifCount: avifVariants.length,
    });
  } catch (error) {
    logger.error("Failed to process images", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_PROCESSING_FAILED,
      uid,
      slug,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to process image. Please try a different image.",
    );
  }

  // 7. Upload to GitHub using batch operations
  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });
  const octokit = await app.getInstallationOctokit(
    Number.parseInt(GITHUB_INSTALLATION_ID),
  );

  try {
    // 7a. Check which files exist to determine create vs update
    const filesToCheck = [
      `${slug}-profile.jpg`,
      ...avifVariants.map((v) => v.filename),
    ];

    const existingFiles = new Map<string, string>(); // filename -> SHA

    for (const filename of filesToCheck) {
      const path = `hugo/content/doulas/${slug}/${filename}`;
      try {
        const { data: file } = await octokit.rest.repos.getContent({
          owner: GITHUB_OWNER,
          repo: GITHUB_REPO,
          path,
        });
        if ("sha" in file) {
          existingFiles.set(filename, file.sha);
        }
      } catch (error: unknown) {
        // 404 is expected for new files
        if (isGitHubError(error) && error.status === 404) {
          continue;
        }
        // Log other errors but continue - batch operation will handle failures
        logger.warn(`Failed to check file existence: ${filename}`, {
          uid,
          slug,
          filename,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // 7b. Build operations array
    const operations: FileOperation[] = [];

    // Add JPEG operation
    const jpegFilename = `${slug}-profile.jpg`;
    const jpegPath = `hugo/content/doulas/${slug}/${jpegFilename}`;
    const jpegSha = existingFiles.get(jpegFilename);

    operations.push({
      path: jpegPath,
      operation: jpegSha ? "update" : "create",
      content: jpegBuffer.toString("base64"),
      ...(jpegSha ? { sha: jpegSha } : {}),
    });

    // Add AVIF operations
    for (const variant of avifVariants) {
      const variantPath = `hugo/content/doulas/${slug}/${variant.filename}`;
      const variantSha = existingFiles.get(variant.filename);

      operations.push({
        path: variantPath,
        operation: variantSha ? "update" : "create",
        content: variant.buffer.toString("base64"),
        ...(variantSha ? { sha: variantSha } : {}),
      });
    }

    // Add delete operations for old format variants
    const oldExtensions = [".jpeg", ".png", ".webp"];
    for (const extension of oldExtensions) {
      operations.push({
        path: `hugo/content/doulas/${slug}/${slug}-profile${extension}`,
        operation: "delete",
      });
    }

    // 7c. Execute batch operation
    const result = await batchOperateFiles({
      octokit,
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      branch: GITHUB_BRANCH,
      operations,
      commitMessage: `Update profile images for ${slug}

- Updated profile.jpg
- Generated AVIF variants (1200px, 600px, 300px)
- Removed old format variants`,
    });

    logger.info(`Successfully uploaded profile images for ${slug}`, {
      commitSha: result.commitSha,
      createdFiles: result.createdFiles,
      updatedFiles: result.updatedFiles,
      deletedFiles: result.deletedFiles,
    });

    return { success: true };
  } catch (error: unknown) {
    logger.error("Failed to upload profile images to GitHub", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_BATCH_OPERATION_FAILED,
      uid,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });

    // Check if it's a concurrent modification error
    if (
      error instanceof Error &&
      error.message.includes("modified by another operation")
    ) {
      throw new HttpsError(
        "aborted",
        "Profile was modified by another operation. Please try again.",
      );
    }

    throw new HttpsError(
      "internal",
      "Failed to save profile images. Please try again.",
    );
  }
}
