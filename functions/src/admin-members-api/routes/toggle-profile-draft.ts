import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ToggleProfileDraftApiResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Route handler for POST /:memberId/profile/toggle-draft.
 * Toggles the draft status of a member's profile.
 */
export async function toggleProfileDraftLogic({
  memberId,
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  memberId: string;
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ToggleProfileDraftApiResponse> {
  try {
    const result = await memberAdminService.toggleProfileDraft({ memberId });

    logger.info("Admin toggled profile draft status", {
      adminUid,
      memberId,
      slug: result.slug,
      draft: result.draft,
      hugoRebuildTriggered: result.hugoRebuildTriggered,
    });

    return {
      success: true,
      slug: result.slug,
      draft: result.draft,
      ...(result.hugoRebuildTriggered === false && {
        warning: "Profile draft status updated but Hugo rebuild failed.",
      }),
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "toggle profile draft",
      errorId: ERROR_IDS.API_ADMIN_TOGGLE_DRAFT_FAILED,
      logger,
      set,
      context: { memberId, adminUid },
    });
  }
}
