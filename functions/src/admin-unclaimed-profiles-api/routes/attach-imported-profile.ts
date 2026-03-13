import { ERROR_IDS } from "../../constants/error-ids.js";
import { HttpError, NotFoundError } from "../../shared-api/errors/http-error.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { AttachImportedProfileResponse } from "../schemas/unclaimed-profile-schemas.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";

export async function attachImportedProfileLogic({
  email,
  memberUid,
  adminUid,
  unclaimedProfileAdminService,
  logger,
  set,
}: {
  email: string;
  memberUid: string;
  adminUid: string;
  unclaimedProfileAdminService: UnclaimedProfileAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<AttachImportedProfileResponse> {
  try {
    logger.info("Admin attaching imported member record", {
      adminUid,
      email,
      memberUid,
    });

    const result = await unclaimedProfileAdminService.attachImportedProfile({
      email,
      memberUid,
      logger,
    });

    return result;
  } catch (error: unknown) {
    if (error instanceof NotFoundError || error instanceof HttpError) {
      set.status = error.statusCode;
      return { error: error.message };
    }

    return handleRouteError({
      error,
      operation: "attach imported profile",
      errorId: ERROR_IDS.API_ADMIN_ATTACH_IMPORTED_PROFILE_FAILED,
      logger,
      set,
      context: { email, memberUid, adminUid },
    });
  }
}
