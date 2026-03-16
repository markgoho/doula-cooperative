import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { createMemberRouteHandler } from "./route-handler-factory.js";

interface ActivateMembershipParameters extends Record<string, unknown> {
  subscriptionStart?: string;
  membershipExpiresAt?: string;
}

export const activateMembershipLogic =
  createMemberRouteHandler<ActivateMembershipParameters>({
    operation: "activated membership",
    errorId: ERROR_IDS.API_ADMIN_ACTIVATE_MEMBERSHIP_FAILED,

    serviceMethod: (
      service,
      memberId,
      { subscriptionStart, membershipExpiresAt },
    ) =>
      service.activateMembership(memberId, {
        ...(subscriptionStart !== undefined && { subscriptionStart }),
        ...(membershipExpiresAt !== undefined && { membershipExpiresAt }),
      }),

    parseParameters: parameters => parameters,

    getLogContext: (memberId, adminUid, member) => ({
      adminUid,
      targetMemberId: memberId,
      subscriptionStart: member.subscriptionStart,
      membershipExpiresAt: member.membershipExpiresAt,
    }),

    getErrorContext: memberId => ({ memberId }),
  });
