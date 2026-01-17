import { App } from "octokit";
import sharp from "sharp";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../constants/github-config.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import type { CropData } from "../utils/crop-data.js";
import {
  batchOperateFiles,
  type FileOperation,
} from "../utils/github-batch-operations.js";
import { isGitHubError } from "../utils/github-error.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB
const OUTPUT_SIZE = 1200; // Max dimension for output image
const AVIF_SIZES = [1200, 600, 300] as const;
const AVIF_QUALITY = 50;

interface AvifVariant {
  filename: string;
  buffer: Buffer;
  size: number;
}

/**
 * Processes an image by applying crop and generating all required variants.
 * Returns the JPEG buffer and AVIF variants.
 */
async function processImage({
  imageBuffer,
  cropData,
  slug,
  logger,
}: {
  imageBuffer: Buffer;
  cropData: CropData;
  slug: string;
  logger: Logger;
}): Promise<{ jpegBuffer: Buffer; avifVariants: AvifVariant[] }> {
  // Extract crop region and resize to output size
  const processedBuffer = await sharp(imageBuffer)
    .extract({
      left: Math.round(cropData.x),
      top: Math.round(cropData.y),
      width: Math.round(cropData.width),
      height: Math.round(cropData.height),
    })
    .resize(OUTPUT_SIZE, OUTPUT_SIZE, { fit: "cover" })
    .toBuffer();

  // Generate JPEG
  const jpegBuffer = await sharp(processedBuffer)
    .jpeg({ quality: 90 })
    .toBuffer();

  // Generate AVIF variants
  const avifVariants = await generateAvifVariants({
    processedBuffer,
    slug,
    logger,
  });

  return { jpegBuffer, avifVariants };
}

/**
 * Generates AVIF variants at multiple sizes from a processed image buffer.
 * Returns an array of AVIF variants with filenames and buffers.
 *
 * @throws Error if any variant fails to generate (all-or-nothing)
 */
async function generateAvifVariants({
  processedBuffer,
  slug,
  logger,
}: {
  processedBuffer: Buffer;
  slug: string;
  logger: Logger;
}): Promise<AvifVariant[]> {
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

/**
 * Upload profile image for authenticated user.
 * Processes the image (crops, resizes, generates variants) and uploads to GitHub.
 * POST /api/profiles/me/image
 */
export async function uploadImageLogic({
  uid,
  imageData,
  cropData,
  profileMemberService,
  logger,
  set,
}: {
  uid: string;
  imageData: string;
  cropData: CropData;
  profileMemberService: ProfileMemberService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<{ success: true } | { error: string }> {
  logger.info("Profile image upload initiated", { uid });

  try {
    // Verify user has active membership and get slug FIRST
    const member = await profileMemberService.verifyActiveMembership(uid);
    const slug = member.slug;

    if (!slug) {
      set.status = 428;
      return {
        error: "Profile slug is required. Please set up your profile first.",
      };
    }

    // Decode base64 image
    const base64Content = imageData.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Content, "base64");

    // Validate image size
    if (imageBuffer.length > MAX_IMAGE_SIZE) {
      logger.warn("Image too large", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_TOO_LARGE,
        uid,
        size: imageBuffer.length,
      });
      set.status = 413;
      return {
        error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
      };
    }

    // Verify GitHub secrets are configured
    const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
    const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
    const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
      logger.error("Missing GitHub secrets for profile image upload", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_GITHUB_FAILED,
        hasAppId: Boolean(GITHUB_APP_ID),
        hasPrivateKey: Boolean(GITHUB_PRIVATE_KEY),
        hasInstallationId: Boolean(GITHUB_INSTALLATION_ID),
      });
      throw new HttpError("Missing GitHub configuration", 500);
    }

    // Process image (crop, resize, and generate variants)
    let jpegBuffer: Buffer;
    let avifVariants: AvifVariant[];

    try {
      const result = await processImage({
        imageBuffer,
        cropData,
        slug,
        logger,
      });
      jpegBuffer = result.jpegBuffer;
      avifVariants = result.avifVariants;

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
      set.status = 500;
      return {
        error: "Failed to process image. Please try a different image.",
      };
    }

    // Upload to GitHub using batch operations
    const app = new App({
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_PRIVATE_KEY,
    });
    const octokit = await app.getInstallationOctokit(
      Number.parseInt(GITHUB_INSTALLATION_ID),
    );

    try {
      // Check which files exist to determine create vs update
      const filesToCheck = [
        `${slug}-profile.jpg`,
        ...avifVariants.map(variant => variant.filename),
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

      // Build operations array
      const operations: FileOperation[] = [];

      // Add JPEG operation
      const jpegFilename = `${slug}-profile.jpg`;
      const jpegPath = `hugo/content/doulas/${slug}/${jpegFilename}`;
      const jpegSha = existingFiles.get(jpegFilename);

      operations.push({
        path: jpegPath,
        operation: jpegSha ? "update" : "create",
        content: jpegBuffer.toString("base64"),
        ...(jpegSha !== undefined && { sha: jpegSha }),
      });

      // Add AVIF operations
      for (const variant of avifVariants) {
        const variantPath = `hugo/content/doulas/${slug}/${variant.filename}`;
        const variantSha = existingFiles.get(variant.filename);

        operations.push({
          path: variantPath,
          operation: variantSha ? "update" : "create",
          content: variant.buffer.toString("base64"),
          ...(variantSha !== undefined && { sha: variantSha }),
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

      // Execute batch operation
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
        set.status = 409;
        return {
          error: "Profile was modified by another operation. Please try again.",
        };
      }

      set.status = 500;
      return { error: "Failed to save profile images. Please try again." };
    }
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "upload profile image",
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_FAILED,
      logger,
      set,
      context: { uid },
    });
  }
}
