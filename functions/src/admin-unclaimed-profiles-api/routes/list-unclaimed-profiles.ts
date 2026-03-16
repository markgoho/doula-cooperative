import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import type { ListUnclaimedProfilesResponse } from "../schemas/unclaimed-profile-schemas.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

interface ListUnclaimedProfilesLogicParameters {
  limit?: number;
  offset?: number;
  adminUid: string;
  unclaimedProfileAdminService: UnclaimedProfileAdminService;
  logger: Logger;
  set: { status?: number | string };
}

export async function listUnclaimedProfilesLogic({
  limit,
  offset,
  adminUid,
  unclaimedProfileAdminService,
  logger,
  set,
}: ListUnclaimedProfilesLogicParameters): Promise<
  ListUnclaimedProfilesResponse | { error: string }
> {
  try {
    const result = await unclaimedProfileAdminService.listUnclaimedProfiles({
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
      logger,
    });

    logger.info("Admin listed unclaimed profiles", {
      adminUid,
      resultCount: result.profiles.length,
      total: result.total,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "list unclaimed profiles",
      errorId: ERROR_IDS.API_ADMIN_LIST_UNCLAIMED_PROFILES_FAILED,
      logger,
      set,
      context: { limit, offset, adminUid },
    });
  }
}
