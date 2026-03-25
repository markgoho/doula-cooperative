import { ERROR_IDS } from "../../constants/error-ids.js";
import type { ApproveProfileApiResponse } from "../schemas/member-schemas.js";
import { toMemberResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";

export async function approveProfileLogic({
  memberId,
  allowProfileEditing,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  memberId: string;
  allowProfileEditing: boolean;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ApproveProfileApiResponse> {
  try {
    logger.info("Admin updating member profile editing permission", {
      adminUid,
      memberId,
    });

    const result = await memberAdminService.approveProfile({
      memberId,
      allowProfileEditing,
    });

    let isAdmin = false;
    try {
      isAdmin = await memberAdminService.isAdmin(result.member.uid, logger);
    } catch {
      logger.warn("Failed to check admin status for approved member", {
        memberId,
      });
    }

    return {
      success: true,
      member: toMemberResponse(result.member, isAdmin),
    };
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "update member profile editing permission",
      errorId: ERROR_IDS.API_ADMIN_UPDATE_MEMBER_FAILED,
      logger,
      set,
      context: { memberId, allowProfileEditing, adminUid },
    }) as ApproveProfileApiResponse;
  }
}
