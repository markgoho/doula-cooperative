import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import { type DeleteUserResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Delete a user account logic (admin only).
 * Admin authentication is handled by the plugin guard.
 *
 * @returns Success response or error object
 */
export async function deleteUserLogic({
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
}): Promise<DeleteUserResponse | { error: string }> {
  try {
    // Delete user (adminUid is used to prevent self-deletion)
    await memberAdminService.deleteUser(memberId, adminUid);

    // Audit log successful deletion
    logger.info("Admin deleted user", {
      adminUid,
      deletedUid: memberId,
    });

    return { success: true, deletedUid: memberId };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "delete user",
      errorId: ERROR_IDS.API_ADMIN_DELETE_USER_FAILED,
      logger,
      set,
      context: { memberId },
    });
  }
}
