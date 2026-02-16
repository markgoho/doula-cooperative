import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileGitHubService } from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import { getImageKitClient } from "../utils/imagekit-client.js";

export async function deleteImageLogic({
  uid,
  profileMemberService,
  profileGitHubService,
  logger,
  set,
}: {
  uid: string;
  profileMemberService: ProfileMemberService;
  profileGitHubService: ProfileGitHubService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<{ success: true } | { error: string }> {
  logger.info("Profile image delete initiated", { uid });

  try {
    const member = await profileMemberService.verifyActiveMembership(uid);
    const slug = member.slug;

    if (!slug) {
      set.status = 428;
      return {
        error: "Profile slug is required. Please set up your profile first.",
      };
    }

    // Search ImageKit for the file by known path convention
    const expectedPath = `/doulas/${slug}/${slug}-profile`;
    try {
      const imagekit = getImageKitClient();
      const results = await imagekit.listFiles({
        searchQuery: `name="${slug}-profile"`,
        path: `/doulas/${slug}`,
        limit: 1,
      });

      const firstResult = results[0];
      if (firstResult && "fileId" in firstResult) {
        await imagekit.deleteFile(firstResult.fileId);
        logger.info("Successfully deleted image from ImageKit", {
          uid,
          slug,
          fileId: firstResult.fileId,
        });
      } else {
        logger.info("No ImageKit file found at expected path, skipping", {
          uid,
          slug,
          expectedPath,
        });
      }
    } catch (error: unknown) {
      logger.error("Failed to delete image from ImageKit", {
        errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      set.status = 500;
      return { error: "Failed to delete profile image. Please try again." };
    }

    // Remove imagekit_path from GitHub front matter
    try {
      await profileGitHubService.removeFrontMatterImagePath({ slug });

      logger.info("Removed imagekit_path from GitHub front matter", {
        uid,
        slug,
      });
    } catch (error: unknown) {
      logger.error("Failed to update GitHub front matter", {
        errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        error: error instanceof Error ? error.message : String(error),
      });
      // Don't fail - ImageKit deletion succeeded
      logger.warn(
        "Image deleted from ImageKit but GitHub front matter update failed",
        { uid, slug },
      );
    }

    return { success: true };
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
