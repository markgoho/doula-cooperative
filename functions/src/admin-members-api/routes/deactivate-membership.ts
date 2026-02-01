import { ERROR_IDS } from "../../constants/error-ids.js";
import { type MemberSuccessResponse } from "../schemas/member-schemas.js";
import { createMemberRouteHandler } from "./route-handler-factory.js";

/* eslint-disable @typescript-eslint/no-empty-object-type */
export const deactivateMembershipLogic = createMemberRouteHandler<{}>({
  operation: "deactivated membership",
  errorId: ERROR_IDS.API_ADMIN_DEACTIVATE_MEMBERSHIP_FAILED,

  serviceMethod: (service, memberId) => service.deactivateMembership(memberId),

  parseParameters: parameters => parameters,

  getLogContext: (memberId, adminUid) => ({
    adminUid,
    targetMemberId: memberId,
  }),

  getErrorContext: memberId => ({ memberId }),
});
/* eslint-enable @typescript-eslint/no-empty-object-type */

export type DeactivateMembershipLogic = typeof deactivateMembershipLogic;
export type DeactivateMembershipResult = Promise<
  MemberSuccessResponse | { error: string }
>;
