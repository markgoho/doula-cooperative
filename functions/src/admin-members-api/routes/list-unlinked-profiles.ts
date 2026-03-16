import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import type { ListUnlinkedProfilesApiResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Route handler for GET /unlinked-profiles.
 * Lists all profiles that are not linked to a member account.
 */
export async function listUnlinkedProfilesLogic({
  adminUid,
  memberAdminService,
  logger,
  set,
}: {
  adminUid: string;
  memberAdminService: MemberAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<ListUnlinkedProfilesApiResponse> {
  try {
    const result = await memberAdminService.listUnlinkedProfiles();

    logger.info("Admin listed unlinked profiles", {
      adminUid,
      profileCount: result.profiles.length,
    });

    return {
      profiles: result.profiles,
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "list unlinked profiles",
      errorId: ERROR_IDS.API_ADMIN_LIST_UNLINKED_PROFILES_FAILED,
      logger,
      set,
      context: { adminUid },
    });
  }
}
