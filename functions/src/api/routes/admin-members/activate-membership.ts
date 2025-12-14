import { ERROR_IDS } from "../../../constants/error-ids.js";
import { HttpError } from "../../errors/http-error.js";
import {
  toMemberResponse,
  type MemberSuccessResponse,
} from "../../schemas/member-schemas.js";
import type {
  MemberAdminService,
  AuthService,
} from "../../services/service-interfaces.js";
import type { Logger } from "../../handler.js";

/**
 * Activate a membership logic (admin only).
 *
 * @returns Updated member or error object
 */
export async function activateMembershipLogic({
  memberId,
  subscriptionStart,
  membershipExpiresAt,
  memberAdminService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  subscriptionStart?: string;
  membershipExpiresAt?: string;
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
    logger.info("Admin activated membership", {
      adminUid: decodedToken.uid,
      targetMemberId: memberId,
      subscriptionStart,
      membershipExpiresAt,
    });

    // Activate membership
    const member = await memberAdminService.activateMembership(memberId, {
      ...(subscriptionStart !== undefined && { subscriptionStart }),
      ...(membershipExpiresAt !== undefined && { membershipExpiresAt }),
    });

    return { success: true, member: toMemberResponse(member) };
  } catch (error) {
    // Handle our custom HTTP errors
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    // Log unexpected errors with context
    const errorContext = {
      errorId: ERROR_IDS.API_ADMIN_ACTIVATE_MEMBERSHIP_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      memberId,
      hasAuthorizationHeader: !!authorizationHeader,
    };

    logger.error("Failed to activate membership", errorContext);

    set.status = 500;
    return { error: "Failed to activate membership" };
  }
}
