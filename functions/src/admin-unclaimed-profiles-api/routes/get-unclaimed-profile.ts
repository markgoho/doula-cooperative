import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { UnclaimedProfileResponse } from "../schemas/unclaimed-profile-schemas.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

export async function getUnclaimedProfileLogic({
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
}): Promise<UnclaimedProfileResponse | { error: string }> {
  try {
    const result = await unclaimedProfileAdminService.getUnclaimedProfile({
      email,
      logger,
    });

    logger.info("Admin retrieved unclaimed profile", { adminUid, email });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get unclaimed profile",
      errorId: ERROR_IDS.API_ADMIN_GET_UNCLAIMED_PROFILE_FAILED,
      logger,
      set,
    });
  }
}
