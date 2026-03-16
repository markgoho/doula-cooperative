import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import { deleteProfileImage } from "../services/imagekit/delete-profile-image.js";
import type { ProfileMemberService } from "../services/member/interface.js";

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

    try {
      await deleteProfileImage({ slug });
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
