import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { UpdateMemberBody } from "../schemas/member-schemas.js";
import { createMemberRouteHandler } from "./route-handler-factory.js";

interface UpdateMemberParameters extends Record<string, unknown> {
  updates: UpdateMemberBody;
}

export const updateMemberLogic =
  createMemberRouteHandler<UpdateMemberParameters>({
    operation: "updated member",
    errorId: ERROR_IDS.API_ADMIN_UPDATE_MEMBER_FAILED,

    serviceMethod: (service, memberId, { updates }) =>
      service.updateMember(memberId, updates),

    parseParameters: parameters => parameters,

    getLogContext: (memberId, adminUid, _member, { updates }) => ({
      adminUid,
      targetMemberId: memberId,
      updatedFields: Object.keys(updates),
    }),

    getErrorContext: (memberId, { updates }) => ({
      memberId,
      updateFields: Object.keys(updates),
    }),
  });
