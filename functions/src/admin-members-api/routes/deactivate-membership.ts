import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import {
  toMemberResponse,
  type MemberSuccessResponse,
} from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Deactivate a membership logic (admin only).
 * Admin authentication is handled by the plugin guard.
 *
 * @returns Updated member or error object
 */
export async function deactivateMembershipLogic({
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
}): Promise<MemberSuccessResponse | { error: string }> {
  try {
    const member = await memberAdminService.deactivateMembership(memberId);

    logger.info("Admin deactivated membership", {
      adminUid,
      targetMemberId: memberId,
    });

    return { success: true, member: toMemberResponse(member) };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "deactivate membership",
      errorId: ERROR_IDS.API_ADMIN_DEACTIVATE_MEMBERSHIP_FAILED,
      logger,
      set,
      context: { memberId },
    });
  }
}
