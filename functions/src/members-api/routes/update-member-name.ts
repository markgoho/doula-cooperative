import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError } from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import {
  toMemberResponse,
  type MemberResponse,
} from "../schemas/member-schemas.js";
import type { MemberService } from "../services/member/interface.js";

/**
 * Update member name logic (authenticated).
 * Requires authentication - users can update their own name, admins can update any member.
 *
 * @returns Success response with updated member data, or error object
 */
export async function updateMemberNameLogic({
  memberId,
  name,
  memberService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  name: string;
  memberService: MemberService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<{ success: true; member: MemberResponse } | { error: string }> {
  try {
    // Verify authentication and authorization
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );

    const isAdmin = decodedToken["admin"] === true;
    logger.info("Authorized member name update", {
      requestingUser: decodedToken.uid,
      targetMember: memberId,
      isAdmin,
    });

    // Update the name via service
    const updatedMember = await memberService.updateName(memberId, name);

    return {
      success: true,
      member: toMemberResponse(updatedMember, isAdmin),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to update member name", {
      errorId: ERROR_IDS.UPDATE_MEMBER_NAME_ROUTE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      memberId,
      hasAuthorizationHeader: Boolean(authorizationHeader),
    });

    set.status = 500;
    return { error: "Failed to update member name" };
  }
}
