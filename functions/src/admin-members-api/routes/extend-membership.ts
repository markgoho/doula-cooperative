import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import { createMemberRouteHandler } from "./route-handler-factory.js";

interface ExtendMembershipParameters extends Record<string, unknown> {
  newExpirationDate: string;
}

export const extendMembershipLogic =
  createMemberRouteHandler<ExtendMembershipParameters>({
    operation: "extended membership",
    errorId: ERROR_IDS.API_ADMIN_EXTEND_MEMBERSHIP_FAILED,

    serviceMethod: (service, memberId, { newExpirationDate }) =>
      service.extendMembership(memberId, newExpirationDate),

    parseParameters: parameters => parameters,

    getLogContext: (memberId, adminUid, member) => ({
      adminUid,
      targetMemberId: memberId,
      newExpirationDate: member.membershipExpiresAt,
    }),

    getErrorContext: (memberId, { newExpirationDate }) => ({
      memberId,
      newExpirationDate,
    }),
  });
