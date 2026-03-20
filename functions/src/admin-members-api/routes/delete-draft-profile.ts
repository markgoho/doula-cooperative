import { ERROR_IDS } from "../../constants/error-ids.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { DeleteDraftProfileApiResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Route handler for POST /:memberId/profile/delete-draft.
 * Deletes a member's draft profile while preserving the member account.
 */
export async function deleteDraftProfileLogic({
  memberId,
  adminUid,
  memberAdminService,
  emailService,
  logger,
  set,
}: {
  memberId: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  emailService?: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}): Promise<DeleteDraftProfileApiResponse> {
  try {
    const result = await memberAdminService.deleteDraftProfile({
      memberId,
      ...(emailService !== undefined && { emailService }),
    });

    logger.info("Admin deleted draft profile", {
      adminUid,
      memberId,
      slug: result.slug,
      profileDeleted: result.profileDeleted,
      profileImageDeleted: result.profileImageDeleted,
      memberUpdated: result.memberUpdated,
      hugoRebuildTriggered: result.hugoRebuildTriggered,
    });

    const warnings: string[] = [];
    if (!result.hugoRebuildTriggered) {
      warnings.push("Hugo rebuild failed");
    }
    if (!result.profileImageDeleted) {
      warnings.push("Profile image deletion failed or not found");
    }

    return {
      success: true,
      slug: result.slug,
      profileDeleted: result.profileDeleted,
      profileImageDeleted: result.profileImageDeleted,
      memberUpdated: result.memberUpdated,
      ...(warnings.length > 0 && { warning: warnings.join("; ") }),
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "delete draft profile",
      errorId: ERROR_IDS.API_ADMIN_DELETE_DRAFT_PROFILE_FAILED,
      logger,
      set,
      context: { memberId, adminUid },
    });
  }
}
