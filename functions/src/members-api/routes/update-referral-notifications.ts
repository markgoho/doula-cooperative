import { ERROR_IDS } from "../../constants/error-ids.js";
import {
  ForbiddenError,
  HttpError,
} from "../../shared-api/errors/http-error.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { UpdateReferralNotificationsResponse } from "../schemas/member-schemas.js";
import type { MemberService } from "../services/member/interface.js";

/**
 * Route logic for PATCH /:memberId/referral-notifications
 *
 * Turns the Member's Referral Notifications on or off. Owner only: an Admin
 * can't change another Member's email preference.
 */
export async function updateReferralNotificationsLogic({
  memberId,
  enabled,
  memberService,
  authService,
  logger,
  authorizationHeader,
  set,
}: {
  memberId: string;
  enabled: boolean;
  memberService: MemberService;
  authService: AuthService;
  logger: Logger;
  authorizationHeader: string | undefined;
  set: { status?: number | string };
}): Promise<UpdateReferralNotificationsResponse> {
  try {
    const decodedToken = await authService.verifyOwnerOrAdmin(
      authorizationHeader,
      memberId,
    );

    if (decodedToken.uid !== memberId) {
      throw new ForbiddenError(
        "You can only change your own referral email preference",
      );
    }

    const updatedMember = await memberService.updateReferralNotifications(
      memberId,
      enabled,
    );

    logger.info("Updated Referral Notification preference", {
      memberId,
      enabled,
    });

    return {
      success: true,
      enabled: updatedMember.referralNotificationsEnabled !== false,
    };
  } catch (error: unknown) {
    if (error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    logger.error("Failed to update Referral Notification preference", {
      errorId: ERROR_IDS.UPDATE_REFERRAL_NOTIFICATIONS_ROUTE_FAILED,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
      errorType: error?.constructor?.name,
      memberId,
      hasAuthorizationHeader: Boolean(authorizationHeader),
    });

    set.status = 500;
    return { error: "Failed to update referral email preference" };
  }
}
