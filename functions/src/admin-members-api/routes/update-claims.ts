import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import { type UpdateClaimsResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Update custom claims logic (admin only).
 * Admin authentication is handled by the plugin guard.
 *
 * @returns Success response or error object
 */
export async function updateClaimsLogic({
  uid,
  claims,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  uid: string;
  claims: { admin?: boolean };
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<UpdateClaimsResponse | { error: string }> {
  try {
    await memberAdminService.updateClaims({
      uid,
      claims,
      requestingAdminUid: adminUid,
      logger,
    });

    logger.info("Admin updated custom claims for user", {
      adminUid,
      targetUid: uid,
      claims,
    });

    return { success: true, uid };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "update custom claims",
      errorId: ERROR_IDS.API_ADMIN_SET_ADMIN_CLAIM_FAILED,
      logger,
      set,
      context: { uid, claims, adminUid },
    });
  }
}
