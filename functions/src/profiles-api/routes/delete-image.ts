import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import { deleteProfileImage } from "../services/imagekit/delete-profile-image.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import type { ProfileStoreService } from "../services/profile-store/interface.js";
import { triggerHugoRebuild } from "../services/profile-store/trigger-rebuild.js";

export async function deleteImageLogic({
  uid,
  slug,
  isAdmin,
  profileMemberService,
  profileStoreService,
  logger,
  set,
}: {
  uid: string;
  slug: string;
  isAdmin: boolean;
  profileMemberService: ProfileMemberService;
  profileStoreService: ProfileStoreService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<{ success: true; warning?: string } | { error: string }> {
  logger.info("Profile image delete initiated", { uid, slug, isAdmin });

  try {
    // Admins delete on behalf of a member, so the target is the slug in the
    // URL. Members delete their own image and must still hold an active
    // membership; route authorization has already proven the slug is theirs.
    if (!isAdmin) {
      const member = await profileMemberService.verifyActiveMembership(uid);

      if (!member.slug) {
        set.status = 428;
        return {
          error: "Profile slug is required. Please set up your profile first.",
        };
      }
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

    // Throws if the profile is missing or the write fails: without this stamp
    // the public URL never changes and visitors keep the removed photo.
    await profileStoreService.stampProfileImageUpdated({ slug });

    const warning = await requestRebuild({ slug, logger });

    return { success: true, ...(warning && { warning }) };
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

/**
 * Ask GitHub to rebuild the public site so the removal ships.
 *
 * Non-critical: the timestamp is already stored, so the next profile edit
 * rebuilds with it. Returns a warning for the caller to surface instead.
 */
async function requestRebuild({
  slug,
  logger,
}: {
  slug: string;
  logger: Logger;
}): Promise<string | undefined> {
  try {
    await triggerHugoRebuild({
      slug,
      action: "removed profile image",
      notificationType: "image-delete",
    });
    return undefined;
  } catch (error: unknown) {
    logger.error("Failed to trigger rebuild after profile image delete", {
      errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_FAILED,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    return "Image removed, but the public site rebuild could not be started. It will publish with the next profile update.";
  }
}
