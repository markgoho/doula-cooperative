import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import {
  toMemberResponse,
  type MemberResponse,
} from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Get a single member by ID (admin only).
 * Admin authentication is handled by the plugin guard.
 *
 * @returns Member data or error object
 */
export async function getMemberLogic({
  memberId,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  memberId: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<MemberResponse | { error: string }> {
  try {
    const member = await memberAdminService.verifyMemberExists(memberId);

    // Check if the target member has admin privileges via service
    const isAdmin = await memberAdminService.isAdmin(memberId, logger);

    logger.info("Admin retrieved member", {
      adminUid,
      targetMemberId: memberId,
    });

    return toMemberResponse(member, isAdmin);
  } catch (error) {
    return handleRouteError({
      error,
      operation: "get member",
      errorId: ERROR_IDS.API_ADMIN_GET_MEMBER_FAILED,
      logger,
      set,
      context: { memberId },
    });
  }
}
