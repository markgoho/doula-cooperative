import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError } from "../../errors/http-error.js";
import type { Logger } from "../../handler.js";
import {
  toMemberResponse,
  type MemberSuccessResponse,
} from "../../schemas/member-schemas.js";
import type { MemberAdminService } from "../../services/service-interfaces.js";

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
    // Audit log successful access
    logger.info("Admin deactivated membership", {
      adminUid,
      targetMemberId: memberId,
    });

    // Deactivate membership
    const member = await memberAdminService.deactivateMembership(memberId);

    return { success: true, member: toMemberResponse(member) };
  } catch (error) {
    // Handle our custom HTTP errors
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // Log unexpected errors with context
    const errorContext = {
      errorId: ERROR_IDS.API_ADMIN_DEACTIVATE_MEMBERSHIP_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      memberId,
    };

    logger.error("Failed to deactivate membership", errorContext);

    set.status = 500;
    return { error: "Failed to deactivate membership" };
  }
}
