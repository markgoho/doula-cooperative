import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

export async function deleteUnclaimedProfileLogic({
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
}): Promise<{ success: true } | { error: string }> {
  try {
    logger.info("Admin delete unclaimed profile request", {
      adminUid,
      email,
    });

    const result = await unclaimedProfileAdminService.deleteUnclaimedProfile({
      email,
      logger,
    });

    logger.info("Unclaimed profile deleted successfully", {
      adminUid,
      email,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "delete unclaimed profile",
      errorId: ERROR_IDS.API_ADMIN_DELETE_UNCLAIMED_PROFILE_FAILED,
      logger,
      set,
      context: { email, adminUid },
    });
  }
}
