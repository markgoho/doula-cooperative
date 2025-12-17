import { App } from "octokit";
import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  GITHUB_BRANCH,
  GITHUB_OWNER,
  GITHUB_REPO,
} from "../../constants/github-config.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import { batchDeleteFiles } from "../utils/github-batch-delete.js";
import { isRateLimitError } from "../utils/github-error.js";
import type { ProfileMemberService } from "../services/member/interface.js";

/**
 * All possible profile image file patterns to delete.
 * Includes source images and generated AVIF variants.
 */
const IMAGE_FILE_PATTERNS = [
  "-profile.jpg",
  "-profile.jpeg",
  "-profile.png",
  "-profile.webp",
  "-profile-1200.avif",
  "-profile-600.avif",
  "-profile-300.avif",
];

/**
 * Delete profile image for authenticated user.
 * Deletes all profile image variants from GitHub.
 * DELETE /api/profiles/me/image
 */
export async function deleteImageLogic({
  uid,
  profileMemberService,
  logger,
  set,
}: {
  uid: string;
  profileMemberService: ProfileMemberService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<
  { success: true; deletedFiles: string[] } | { error: string }
> {
  logger.info("Profile image delete initiated", { uid });

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

    // Verify GitHub secrets are configured
    const GITHUB_APP_ID = process.env["GITHUB_APP_ID"];
    const GITHUB_PRIVATE_KEY = process.env["GITHUB_PRIVATE_KEY"];
    const GITHUB_INSTALLATION_ID = process.env["GITHUB_INSTALLATION_ID"];

    if (!GITHUB_APP_ID || !GITHUB_PRIVATE_KEY || !GITHUB_INSTALLATION_ID) {
      logger.error("Missing GitHub secrets for profile image delete", {
        errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_FAILED,
        hasAppId: Boolean(GITHUB_APP_ID),
        hasPrivateKey: Boolean(GITHUB_PRIVATE_KEY),
        hasInstallationId: Boolean(GITHUB_INSTALLATION_ID),
      });
      throw new HttpError("Missing GitHub configuration", 500);
    }

    // Initialize GitHub client
    const app = new App({
      appId: GITHUB_APP_ID,
      privateKey: GITHUB_PRIVATE_KEY,
    });
    const octokit = await app.getInstallationOctokit(
      Number.parseInt(GITHUB_INSTALLATION_ID),
    );

    const baseDirectory = `hugo/content/doulas/${slug}`;

    // Delete all profile image files in a single commit
    const filePaths = IMAGE_FILE_PATTERNS.map(
      (pattern) => `${baseDirectory}/${slug}${pattern}`,
    );

    try {
      const result = await batchDeleteFiles({
        octokit,
        owner: GITHUB_OWNER,
        repo: GITHUB_REPO,
        branch: GITHUB_BRANCH,
        filePaths,
        commitMessage: `Delete all profile images for ${slug}`,
      });

      logger.info(`Successfully deleted profile images for ${slug}`, {
        deletedFiles: result.deletedFiles,
        commitSha: result.commitSha,
      });

      return {
        success: true,
        deletedFiles: result.deletedFiles,
      };
    } catch (error: unknown) {
      // Rate limit error
      if (isRateLimitError(error)) {
        logger.error("GitHub API rate limit exceeded during delete", {
          errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_RATE_LIMIT,
          uid,
          slug,
        });
        set.status = 429;
        return { error: "Too many requests. Please try again later." };
      }

      // Other errors
      logger.error("Failed to delete profile images", {
        errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_GITHUB_FAILED,
        uid,
        slug,
        error,
      });
      set.status = 500;
      return { error: "Failed to delete profile image. Please try again." };
    }
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "delete profile image",
      errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_FAILED,
      logger,
      set,
      context: { uid },
    });
  }
}
