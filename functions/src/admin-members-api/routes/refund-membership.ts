import { ERROR_IDS } from "../../constants/error-ids.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { RefundMembershipApiResponse } from "../schemas/member-schemas.js";
import { toMemberResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Route handler for POST /:memberId/membership/refund.
 *
 * Custom handler (not factory) since refund returns a richer result
 * than just a MemberDocument wrapped in MemberSuccessResponse.
 */
export async function refundMembershipLogic({
  memberId,
  reason,
  adminUid,
  memberAdminService,
  emailService,
  logger,
  set,
}: {
  memberId: string;
  reason?: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  emailService?: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<RefundMembershipApiResponse> {
  try {
    const result = await memberAdminService.refundMembership({
      memberId,
      ...(reason !== undefined && { reason }),
      ...(emailService !== undefined && { emailService }),
    });

    logger.info("Admin refunded membership", {
      adminUid,
      targetMemberId: memberId,
      stripeRefundCreated: result.stripeRefundCreated,
      subscriptionCanceled: result.subscriptionCanceled,
      memberDeactivated: result.refundActions.memberDeactivated,
    });

    const isAdmin = await memberAdminService.isAdmin(memberId, logger);

    return {
      success: true,
      member: toMemberResponse(result.member, isAdmin),
      refundResult: {
        stripeRefundCreated: result.stripeRefundCreated,
        subscriptionCanceled: result.subscriptionCanceled,
        memberDeactivated: result.refundActions.memberDeactivated,
        ...(result.refundActions.profileDrafted !== undefined && {
          profileDrafted: result.refundActions.profileDrafted,
        }),
        ...(result.refundActions.newsletterUnsubscribed !== undefined && {
          newsletterUnsubscribed: result.refundActions.newsletterUnsubscribed,
        }),
        ...(result.refundActions.memberNotified !== undefined && {
          memberNotified: result.refundActions.memberNotified,
        }),
        ...(result.refundActions.warning !== undefined && {
          warning: result.refundActions.warning,
        }),
      },
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "refund membership",
      errorId: ERROR_IDS.API_ADMIN_REFUND_MEMBERSHIP_FAILED,
      logger,
      set,
      context: { memberId, adminUid },
    });
  }
}
