import { getFirestore } from "firebase-admin/firestore";
import { type CallableRequest, HttpsError } from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import { App, type Octokit } from "octokit";
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
import { batchDeleteFiles } from "../utils/github-batch-delete.js";
import { isGitHubError, isRateLimitError } from "../utils/github-error.js";

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

/**
 * Applies crop and resize to image using sharp.
 * Returns a JPEG buffer of the cropped, square image.
 */
async function processImage(
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

  // Crop to square, resize to output size, convert to JPEG
  return sharp(imageBuffer)
    .extract({
      left: Math.round(left),
      top: Math.round(top),
      width: size,
      height: size,
    })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover" })
    .jpeg({ quality: 90 })
    .toBuffer();
}

/**
 * Deletes old profile images with different extensions using batch delete.
 */
async function deleteOldProfileImages(
  octokit: Octokit,
  owner: string,
  repo: string,
  slug: string,
  currentExtension: string,
): Promise<void> {
  const extensions = [".jpg", ".jpeg", ".png", ".webp"];

  const filePaths = extensions
    .filter((extension) => extension !== currentExtension)
    .map((extension) => `hugo/content/doulas/${slug}/${slug}-profile${extension}`);

  try {
    const result = await batchDeleteFiles({
      octokit,
      owner,
      repo,
      branch: GITHUB_BRANCH,
      filePaths,
      commitMessage: `Remove old profile images for ${slug}`,
    });

    if (result.deletedFiles.length > 0) {
      logger.info(`Deleted old profile images for ${slug}`, {
        deletedFiles: result.deletedFiles,
      });
    }
  } catch (error: unknown) {
    // EXPLICITLY JUSTIFIED: Cleanup failure should not prevent upload success
    // because the new image is the source of truth. Old images don't break functionality.
    logger.error(`Failed to delete old profile images for ${slug}`, {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_CLEANUP_FAILED,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    // Continue with upload - user gets their new image even if cleanup fails
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
  try {
    processedBuffer = await processImage(imageBuffer, cropData);
    logger.info(`Image processed successfully for ${slug}`, {
      originalSize: imageBuffer.length,
      processedSize: processedBuffer.length,
    });
  } catch (error) {
    logger.error("Failed to process image", {
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

  // 7. Upload to GitHub
  const app = new App({
    appId: GITHUB_APP_ID,
    privateKey: GITHUB_PRIVATE_KEY,
  });
  const octokit = await app.getInstallationOctokit(
    Number.parseInt(GITHUB_INSTALLATION_ID),
  );

  const filePath = `hugo/content/doulas/${slug}/${slug}-profile.jpg`;

  try {
    // Check if file exists to get SHA for update
    let existingSha: string | undefined;
    try {
      const { data: existingFile } = await octokit.rest.repos.getContent({
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        path: filePath,
      });
      if ("sha" in existingFile) {
        existingSha = existingFile.sha;
      }
    } catch (error: unknown) {
      // 404 is expected - file doesn't exist, will be created
      if (isGitHubError(error) && error.status === 404) {
        logger.info(`No existing profile image found for ${slug}, will create new file`);
      } else {
        // Log other errors - they may cause the upload to fail
        logger.warn(`Failed to check for existing profile image`, {
          uid,
          slug,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    // Delete old images with different extensions
    await deleteOldProfileImages(octokit, GITHUB_OWNER, GITHUB_REPO, slug, ".jpg");

    // Create or update the image file
    await octokit.rest.repos.createOrUpdateFileContents({
      owner: GITHUB_OWNER,
      repo: GITHUB_REPO,
      path: filePath,
      message: `Update profile image for ${slug}`,
      content: processedBuffer.toString("base64"),
      ...(existingSha ? { sha: existingSha } : {}),
      branch: GITHUB_BRANCH,
    });

    logger.info(`Successfully uploaded profile image for ${slug}`);
    return { success: true };
  } catch (error: unknown) {
    if (isRateLimitError(error)) {
      logger.error("GitHub API rate limit exceeded", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_GITHUB_RATE_LIMIT,
        uid,
        slug,
      });
      throw new HttpsError(
        "resource-exhausted",
        "Too many requests. Please try again later.",
      );
    }

    logger.error("Failed to upload profile image to GitHub", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_GITHUB_FAILED,
      uid,
      slug,
      error,
    });
    throw new HttpsError(
      "internal",
      "Failed to save profile image. Please try again.",
    );
  }
}
