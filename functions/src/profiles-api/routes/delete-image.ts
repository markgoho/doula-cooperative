import { FieldValue } from "firebase-admin/firestore";
import { ERROR_IDS } from "../../constants/error-ids.js";
import { MemberFirestoreService } from "../../shared-api/services/member-firestore/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ProfileMemberService } from "../services/member/interface.js";
import { getImageKitClient } from "../utils/imagekit-client.js";

/**
 * Delete profile image for authenticated user.
 * Deletes image from ImageKit and clears Firestore fields.
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
}): Promise<{ success: true } | { error: string }> {
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

    // Get member document to retrieve imagekitFileId
    const memberDocument = await profileMemberService.getMemberBySlug(slug);

    // If no imagekitFileId exists, consider it already deleted (success case)
    if (!memberDocument?.imagekitFileId) {
      logger.info("No ImageKit file ID found for profile, skipping deletion", {
        uid,
        slug,
      });
      return { success: true };
    }

    // Delete from ImageKit
    try {
      const imagekit = getImageKitClient();
      await imagekit.deleteFile(memberDocument.imagekitFileId);

      logger.info("Successfully deleted image from ImageKit", {
        uid,
        slug,
        fileId: memberDocument.imagekitFileId,
      });
    } catch (error: unknown) {
      logger.error("Failed to delete image from ImageKit", {
        errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        fileId: memberDocument.imagekitFileId,
        error,
      });
      set.status = 500;
      return { error: "Failed to delete profile image. Please try again." };
    }

    // Clear imagekitPath and imagekitFileId from Firestore
    try {
      await MemberFirestoreService.updateMember(uid, {
        imagekitPath: FieldValue.delete(),
        imagekitFileId: FieldValue.delete(),
      });

      logger.info("Successfully cleared ImageKit fields from Firestore", {
        uid,
        slug,
      });
    } catch (error: unknown) {
      logger.error("Failed to clear ImageKit fields from Firestore", {
        errorId: ERROR_IDS.DELETE_PROFILE_IMAGE_FAILED,
        uid,
        slug,
        error,
      });
      // Firestore update failed, but ImageKit deletion succeeded
      // Consider this a partial success - don't fail the request
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
