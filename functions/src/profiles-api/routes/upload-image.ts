import type { UploadResponse } from "imagekit/dist/libs/interfaces/UploadResponse.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileGitHubService } from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import { getImageKitClient } from "../utils/imagekit-client.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

/**
 * Upload profile image for authenticated user.
 * Uploads to ImageKit, updates Firestore and GitHub front matter.
 * POST /api/profiles/:slug/image
 */
export async function uploadImageLogic({
  uid,
  imageData,
  profileMemberService,
  profileGitHubService,
  logger,
  set,
}: {
  uid: string;
  imageData: string;
  profileMemberService: ProfileMemberService;
  profileGitHubService: ProfileGitHubService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<{ success: true; url: string } | { error: string }> {
  logger.info("Profile image upload initiated", { uid });

  try {
    // Verify user has active membership and get slug
    const member = await profileMemberService.verifyActiveMembership(uid);
    const slug = member.slug;

    if (!slug) {
      set.status = 428;
      return {
        error: "Profile slug is required. Please set up your profile first.",
      };
    }

    // Decode base64 image and validate size
    const base64Content = imageData.replace(/^data:image\/\w+;base64,/, "");
    const imageBuffer = Buffer.from(base64Content, "base64");

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

    // Upload to ImageKit
    let uploadResult: UploadResponse;
    try {
      const imagekit = getImageKitClient();
      uploadResult = await imagekit.upload({
        file: imageData, // Full data URL
        fileName: `${slug}-profile`,
        folder: `/doulas/${slug}`,
        useUniqueFileName: false, // Overwrite existing
      });

      logger.info("Image uploaded to ImageKit successfully", {
        uid,
        slug,
        fileId: uploadResult.fileId,
        filePath: uploadResult.filePath,
      });
    } catch (error: unknown) {
      logger.error("Failed to upload image to ImageKit", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 500;
      return {
        error: "Failed to upload image. Please try again.",
      };
    }

    // Update GitHub front matter with imagekit_path
    try {
      await profileGitHubService.updateFrontMatterImagePath({
        slug,
        imagekitPath: uploadResult.filePath,
      });

      logger.info("Updated GitHub front matter with imagekit_path", {
        uid,
        slug,
        imagekitPath: uploadResult.filePath,
      });
    } catch (error: unknown) {
      logger.error("Failed to update GitHub front matter", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail the request - ImageKit upload succeeded
      logger.warn(
        "Image uploaded to ImageKit but GitHub front matter update failed",
        { uid, slug },
      );
    }

    return { success: true, url: uploadResult.url };
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
