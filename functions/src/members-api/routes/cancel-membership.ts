import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { HttpError } from "@doula-coop/functions-shared/shared-api/errors/http-error.js";
import type { AuthService } from "@doula-coop/functions-shared/shared-api/services/auth/interface.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import {
  toMemberResponse,
  type MemberResponse,
} from "../schemas/member-schemas.js";
import type { MemberService } from "../services/member/interface.js";

/**
 * Cancel membership logic (authenticated, self-service).
 * Requires authentication - users can cancel their own membership, admins can cancel any.
 * Only available for Stripe members (returns 400 for legacy members).
 *
 * @returns Success response with updated member data, or error object
 */
export async function cancelMembershipLogic({
  memberId,
  memberService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  memberService: MemberService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<{ success: true; member: MemberResponse } | { error: string }> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );

    const isAdmin = decodedToken["admin"] === true;
    logger.info("Authorized membership cancellation", {
      requestingUser: decodedToken.uid,
      targetMember: memberId,
      isAdmin,
    });

    const updatedMember = await memberService.cancelMembership(memberId);

    return {
      success: true,
      member: toMemberResponse(updatedMember, isAdmin),
    };
  } catch (error) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to cancel membership", {
      errorId: ERROR_IDS.API_MEMBER_CANCEL_MEMBERSHIP_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      memberId,
      hasAuthorizationHeader: Boolean(authorizationHeader),
    });

    set.status = 500;
    return { error: "Failed to cancel membership" };
  }
}
