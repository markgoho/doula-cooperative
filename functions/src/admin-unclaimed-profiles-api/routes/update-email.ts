import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import type { UpdateEmailResponse } from "../schemas/unclaimed-profile-schemas.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

interface UpdateEmailLogicParameters {
  oldEmail: string;
  newEmail: string;
  adminUid: string;
  unclaimedProfileAdminService: UnclaimedProfileAdminService;
  logger: Logger;
  set: { status?: number | string };
}

export async function updateEmailLogic({
  oldEmail,
  newEmail,
  adminUid,
  unclaimedProfileAdminService,
  logger,
  set,
}: UpdateEmailLogicParameters): Promise<
  UpdateEmailResponse | { error: string }
> {
  try {
    const result = await unclaimedProfileAdminService.updateEmail({
      oldEmail,
      newEmail,
      logger,
    });

    logger.info("Admin updated unclaimed profile email", {
      adminUid,
      oldEmail,
      newEmail,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "update email",
      errorId: ERROR_IDS.API_ADMIN_UPDATE_EMAIL_FAILED,
      logger,
      set,
      context: { oldEmail, newEmail, adminUid },
    });
  }
}
