import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError } from "../../errors/http-error.js";
import {
  toMemberResponse,
  type MemberSuccessResponse,
  type UpdateMemberBody,
} from "../../schemas/member-schemas.js";
import type {
  MemberAdminService,
  AuthService,
} from "../../services/service-interfaces.js";
import type { Logger } from "../../handler.js";

/**
 * Update a member's fields logic (admin only).
 *
 * @returns Updated member or error object
 */
export async function updateMemberLogic({
  memberId,
  updates,
  memberAdminService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  updates: UpdateMemberBody;
  memberAdminService: MemberAdminService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<MemberSuccessResponse | { error: string }> {
  try {
    // Verify admin privileges
    const decodedToken = await authService.verifyAdmin(authorizationHeader);

    // Audit log successful access
    logger.info("Admin updated member", {
      adminUid: decodedToken.uid,
      targetMemberId: memberId,
      updatedFields: Object.keys(updates),
    });

    // Update member
    const member = await memberAdminService.updateMember(memberId, updates);

    return { success: true, member: toMemberResponse(member) };
  } catch (error) {
    // Handle our custom HTTP errors
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // Log unexpected errors with context
    const errorContext = {
      errorId: ERROR_IDS.API_ADMIN_UPDATE_MEMBER_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      memberId,
      hasAuthorizationHeader: !!authorizationHeader,
      updateFields: Object.keys(updates),
    };

    logger.error("Failed to update member", errorContext);

    set.status = 500;
    return { error: "Failed to update member" };
  }
}
