import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import {
  toMemberResponse,
  type ChangeSlugApiResponse,
} from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Route handler for POST /:memberId/profile/change-slug.
 * Renames a member's profile slug.
 */
export async function changeSlugLogic({
  memberId,
  newSlug,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  memberId: string;
  newSlug: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ChangeSlugApiResponse> {
  try {
    const result = await memberAdminService.changeSlug({ memberId, newSlug });

    let isAdmin = false;

    try {
      isAdmin = await memberAdminService.isAdmin(memberId, logger);
    } catch (error) {
      logger.error("Failed to enrich slug-changed member with admin status", {
        errorId: ERROR_IDS.API_ADMIN_CHANGE_SLUG_FAILED,
        adminUid,
        memberId,
        newSlug,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    logger.info("Admin changed member profile slug", {
      adminUid,
      memberId,
      oldSlug: result.oldSlug,
      newSlug: result.newSlug,
    });

    return {
      success: true,
      member: toMemberResponse(result.member, isAdmin),
      oldSlug: result.oldSlug,
      newSlug: result.newSlug,
      ...(result.imageMoveWarning !== undefined && {
        imageMoveWarning: result.imageMoveWarning,
      }),
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "change member profile slug",
      errorId: ERROR_IDS.API_ADMIN_CHANGE_SLUG_FAILED,
      logger,
      set,
      context: { adminUid, memberId, newSlug },
    });
  }
}
