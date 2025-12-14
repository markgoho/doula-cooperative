import { ERROR_IDS } from "../../../constants/error-ids.js";
import type { Logger } from "../../handler.js";
import {
  toMemberResponse,
  type MemberSuccessResponse,
} from "../../schemas/member-schemas.js";
import type { MemberAdminService } from "../../services/admin-member/interface.js";
import { handleRouteError } from "../../utils/route-error-handler.js";

/**
 * Extend a membership expiration date logic (admin only).
 * Admin authentication is handled by the plugin guard.
 *
 * @returns Updated member or error object
 */
export async function extendMembershipLogic({
  memberId,
  newExpirationDate,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  memberId: string;
  newExpirationDate: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<MemberSuccessResponse | { error: string }> {
  try {
    const member = await memberAdminService.extendMembership(
      memberId,
      newExpirationDate,
    );

    logger.info("Admin extended membership", {
      adminUid,
      targetMemberId: memberId,
      newExpirationDate: member.membershipExpiresAt,
    });

    return { success: true, member: toMemberResponse(member) };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "extend membership",
      errorId: ERROR_IDS.API_ADMIN_EXTEND_MEMBERSHIP_FAILED,
      logger,
      set,
      context: { memberId, newExpirationDate },
    });
  }
}
