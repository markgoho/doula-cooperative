import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError } from "../../errors/http-error.js";
import { type DeleteUserResponse } from "../../schemas/member-schemas.js";
import type {
  MemberAdminService,
  AuthService,
} from "../../services/service-interfaces.js";
import type { Logger } from "../../handler.js";

/**
 * Delete a user account logic (admin only).
 *
 * @returns Success response or error object
 */
export async function deleteUserLogic({
  memberId,
  memberAdminService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  memberAdminService: MemberAdminService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<DeleteUserResponse | { error: string }> {
  try {
    // Verify admin privileges
    const decodedToken = await authService.verifyAdmin(authorizationHeader);

    // Delete user
    await memberAdminService.deleteUser(memberId, decodedToken.uid);

    // Audit log successful deletion
    logger.info("Admin deleted user", {
      adminUid: decodedToken.uid,
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
      hasAuthorizationHeader: !!authorizationHeader,
    };

    logger.error("Failed to delete user", errorContext);

    set.status = 500;
    return { error: "Failed to delete user" };
  }
}
