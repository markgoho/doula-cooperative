import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import {
  toMemberResponse,
  type MemberSuccessResponse,
  type UpdateMemberBody,
} from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Update a member's fields logic (admin only).
 * Admin authentication is handled by the plugin guard.
 *
 * @returns Updated member or error object
 */
export async function updateMemberLogic({
  memberId,
  updates,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  memberId: string;
  updates: UpdateMemberBody;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<MemberSuccessResponse | { error: string }> {
  try {
    const member = await memberAdminService.updateMember(memberId, updates);

    logger.info("Admin updated member", {
      adminUid,
      targetMemberId: memberId,
      updatedFields: Object.keys(updates),
    });

    return { success: true, member: toMemberResponse(member) };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "update member",
      errorId: ERROR_IDS.API_ADMIN_UPDATE_MEMBER_FAILED,
      logger,
      set,
      context: { memberId, updateFields: Object.keys(updates) },
    });
  }
}
