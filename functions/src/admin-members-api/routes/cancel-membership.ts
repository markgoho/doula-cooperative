import { ERROR_IDS } from "../../constants/error-ids.js";
import { type MemberSuccessResponse } from "../schemas/member-schemas.js";
import { createMemberRouteHandler } from "./route-handler-factory.js";

/* eslint-disable @typescript-eslint/no-empty-object-type */
export const cancelMembershipLogic = createMemberRouteHandler<{}>({
  operation: "canceled membership",
  errorId: ERROR_IDS.API_ADMIN_CANCEL_MEMBERSHIP_FAILED,

  serviceMethod: (service, memberId) => service.cancelMembership(memberId),

  parseParameters: parameters => parameters,

  getLogContext: (memberId, adminUid) => ({
    adminUid,
    targetMemberId: memberId,
  }),

  getErrorContext: memberId => ({ memberId }),
});
/* eslint-enable @typescript-eslint/no-empty-object-type */

export type CancelMembershipLogic = typeof cancelMembershipLogic;
export type CancelMembershipResult = Promise<
  MemberSuccessResponse | { error: string }
>;
