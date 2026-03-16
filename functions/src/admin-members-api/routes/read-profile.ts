import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import type { ReadProfileApiResponse } from "../schemas/member-schemas.js";
import type { MemberAdminService } from "../services/interface.js";

/**
 * Route handler for GET /:memberId/profile.
 * Reads a member's profile directly from Firestore, bypassing public endpoint draft controls.
 */
export async function readProfileLogic({
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
}): Promise<ReadProfileApiResponse> {
  try {
    const result = await memberAdminService.readProfile({ memberId });

    logger.info("Admin read member profile", {
      adminUid,
      memberId,
      slug: result.slug,
    });

    return {
      success: true,
      slug: result.slug,
      profile: result.profile,
    };
  } catch (error) {
    return handleRouteError({
      error,
      operation: "read profile",
      errorId: ERROR_IDS.API_ADMIN_READ_PROFILE_FAILED,
      logger,
      set,
      context: { memberId, adminUid },
    });
  }
}
