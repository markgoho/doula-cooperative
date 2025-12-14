import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError } from "../../errors/http-error.js";
import type { Logger } from "../../handler.js";
import { type DeleteUserResponse } from "../../schemas/member-schemas.js";
import type { MemberAdminService } from "../../services/service-interfaces.js";

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
    // Handle our custom HTTP errors
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // Log unexpected errors with context
    const errorContext = {
      errorId: ERROR_IDS.API_ADMIN_DELETE_USER_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      memberId,
    };

    logger.error("Failed to delete user", errorContext);

    set.status = 500;
    return { error: "Failed to delete user" };
  }
}
