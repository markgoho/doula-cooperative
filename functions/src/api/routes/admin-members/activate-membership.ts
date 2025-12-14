import { ERROR_IDS } from "../../../constants/error-ids.js";
import type { Logger } from "../../handler.js";
import {
  toMemberResponse,
  type MemberSuccessResponse,
} from "../../schemas/member-schemas.js";
import type { MemberAdminService } from "../../services/admin-member/interface.js";
import { handleRouteError } from "../../utils/route-error-handler.js";

/**
 * Activate a membership logic (admin only).
 * Admin authentication is handled by the plugin guard.
 *
 * @returns Updated member or error object
 */
export async function activateMembershipLogic({
  memberId,
  subscriptionStart,
  membershipExpiresAt,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  memberId: string;
  subscriptionStart?: string;
  membershipExpiresAt?: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<MemberSuccessResponse | { error: string }> {
  try {
    const member = await memberAdminService.activateMembership(memberId, {
      ...(subscriptionStart !== undefined && { subscriptionStart }),
      ...(membershipExpiresAt !== undefined && { membershipExpiresAt }),
    });

    logger.info("Admin activated membership", {
      adminUid,
      targetMemberId: memberId,
      subscriptionStart: member.subscriptionStart,
      membershipExpiresAt: member.membershipExpiresAt,
    });

    return { success: true, member: toMemberResponse(member) };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "activate membership",
      errorId: ERROR_IDS.API_ADMIN_ACTIVATE_MEMBERSHIP_FAILED,
      logger,
      set,
      context: { memberId },
    });
  }
}
