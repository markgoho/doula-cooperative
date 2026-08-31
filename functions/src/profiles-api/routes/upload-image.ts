import type ImageKit from "@imagekit/nodejs";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import type { ProfileStoreService } from "../services/profile-store/interface.js";
import { triggerHugoRebuild } from "../services/profile-store/trigger-rebuild.js";
import { getImageKitClient } from "../utils/imagekit-client.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadImageLogic({
  uid,
  slug,
  isAdmin,
  imageData,
  profileMemberService,
  profileStoreService,
  logger,
  set,
}: {
  uid: string;
  slug: string;
  isAdmin: boolean;
  imageData: string;
  profileMemberService: ProfileMemberService;
  profileStoreService: ProfileStoreService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<
  { success: true; url: string; warning?: string } | { error: string }
> {
  logger.info("Profile image upload initiated", { uid, slug, isAdmin });

  try {
    // Admins upload on behalf of a member, so the target is the slug in the
    // URL. Members upload for themselves and must still hold an active
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

    const base64Content = imageData.replace(/^data:image\/\w+;base64,/, "");
    // Buffer.from, not Uint8Array.fromBase64: the deployed Node 24 runtime
    // does not have the base64 Uint8Array methods, so they throw at runtime.
    const imageBuffer = Buffer.from(base64Content, "base64");

    if (imageBuffer.byteLength > MAX_IMAGE_SIZE) {
      logger.warn("Image too large", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_TOO_LARGE,
        uid,
        size: imageBuffer.byteLength,
      });
      set.status = 413;
      return {
        error: `Image too large. Maximum size is ${MAX_IMAGE_SIZE / 1024 / 1024}MB.`,
      };
    }

    let uploadResult: ImageKit.FileUploadResponse;
    try {
      const imagekit = getImageKitClient();
      uploadResult = await imagekit.files.upload({
        file: imageData,
        fileName: `${slug}-profile`,
        folder: `/doulas/${slug}`,
        useUniqueFileName: false,
        transformation: {
          pre: "w-2400,h-2400,c-at_max",
        },
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

    if (!uploadResult.url) {
      logger.error("ImageKit upload returned no URL", {
        errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        fileId: uploadResult.fileId,
      });
      set.status = 500;
      return { error: "Failed to upload image. Please try again." };
    }

    // Throws if the profile is missing or the write fails: without this stamp
    // the public URL never changes and the new photo never reaches visitors.
    await profileStoreService.stampProfileImageUpdated({ slug });

    const warning = await requestRebuild({ slug, logger });

    return {
      success: true,
      url: uploadResult.url,
      ...(warning && { warning }),
    };
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

/**
 * Ask GitHub to rebuild the public site so the new image URL ships.
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
      action: "updated profile image",
      notificationType: "image-update",
    });
    return undefined;
  } catch (error: unknown) {
    logger.error("Failed to trigger rebuild after profile image upload", {
      errorId: ERROR_IDS.UPLOAD_PROFILE_IMAGE_FAILED,
      slug,
      error: error instanceof Error ? error.message : String(error),
    });
    return "Image saved, but the public site rebuild could not be started. It will publish with the next profile update.";
  }
}
