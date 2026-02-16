import type { UploadResponse } from "imagekit/dist/libs/interfaces/UploadResponse.js";
import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import { getImageKitClient } from "../utils/imagekit-client.js";

const MAX_IMAGE_SIZE = 10 * 1024 * 1024; // 10MB

export async function uploadImageLogic({
  uid,
  imageData,
  profileMemberService,
  logger,
  set,
}: {
  uid: string;
  imageData: string;
  profileMemberService: ProfileMemberService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<{ success: true; url: string } | { error: string }> {
  logger.info("Profile image upload initiated", { uid });

  try {
    const member = await profileMemberService.verifyActiveMembership(uid);
    const slug = member.slug;

    if (!slug) {
      set.status = 428;
      return {
        error: "Profile slug is required. Please set up your profile first.",
      };
    }

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

    let uploadResult: UploadResponse;
    try {
      const imagekit = getImageKitClient();
      uploadResult = await imagekit.upload({
        file: imageData,
        fileName: `${slug}-profile`,
        folder: `/doulas/${slug}`,
        useUniqueFileName: false,
        transformation: {
          pre: "w-2400,h-2400",
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
