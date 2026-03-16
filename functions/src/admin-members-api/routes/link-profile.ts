import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import {
  toMemberResponse,
  type LinkProfileApiResponse,
} from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Route handler for POST /:memberId/profile/link.
 * Links an unlinked profile to a member account.
 */
export async function linkProfileLogic({
  memberId,
  slug,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  memberId: string;
  slug: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<LinkProfileApiResponse> {
  try {
    const result = await memberAdminService.linkProfile({ memberId, slug });

    let isAdmin = false;

    try {
      isAdmin = await memberAdminService.isAdmin(memberId, logger);
    } catch (error) {
      logger.error("Failed to enrich linked member with admin status", {
        errorId: ERROR_IDS.API_ADMIN_LINK_PROFILE_FAILED,
        adminUid,
        memberId,
        slug,
        error,
        errorMessage: error instanceof Error ? error.message : "Unknown error",
      });
    }

    logger.info("Admin linked profile to member", {
      adminUid,
      memberId,
      slug,
    });

    return {
      success: true,
      member: toMemberResponse(result.member, isAdmin),
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "link profile to member",
      errorId: ERROR_IDS.API_ADMIN_LINK_PROFILE_FAILED,
      logger,
      set,
      context: { adminUid, memberId, slug },
    });
  }
}
