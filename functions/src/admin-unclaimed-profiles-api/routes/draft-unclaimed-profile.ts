import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { DraftUnclaimedProfileResponse } from "../schemas/unclaimed-profile-schemas.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

export async function draftUnclaimedProfileLogic({
  email,
  adminUid,
  unclaimedProfileAdminService,
  logger,
  set,
}: {
  email: string;
  adminUid: string;
  unclaimedProfileAdminService: UnclaimedProfileAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<DraftUnclaimedProfileResponse> {
  try {
    logger.info("Admin draft unclaimed profile request", {
      adminUid,
      email,
    });

    const result = await unclaimedProfileAdminService.draftUnclaimedProfile({
      email,
      logger,
    });

    logger.info("Unclaimed profile drafted successfully", {
      adminUid,
      email,
      slug: result.slug,
      warning: result.warning,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "draft unclaimed profile",
      errorId: ERROR_IDS.API_ADMIN_DRAFT_UNCLAIMED_PROFILE_FAILED,
      logger,
      set,
      context: { email, adminUid },
    });
  }
}
