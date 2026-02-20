import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { RefreshPaymentDatesResponse } from "../schemas/unclaimed-profile-schemas.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

interface RefreshPaymentDatesLogicParameters {
  adminUid: string;
  unclaimedProfileAdminService: UnclaimedProfileAdminService;
  logger: Logger;
  set: { status?: number | string };
}

export async function refreshPaymentDatesLogic({
  adminUid,
  unclaimedProfileAdminService,
  logger,
  set,
}: RefreshPaymentDatesLogicParameters): Promise<
  RefreshPaymentDatesResponse | { error: string }
> {
  try {
    const result = await unclaimedProfileAdminService.refreshPaymentDates({
      logger,
    });

    logger.info("Admin refreshed payment dates", {
      adminUid,
      updatedCount: result.updatedCount,
      totalCount: result.totalCount,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "refresh payment dates",
      errorId: ERROR_IDS.API_ADMIN_REFRESH_PAYMENT_DATES_FAILED,
      logger,
      set,
      context: { adminUid },
    });
  }
}
