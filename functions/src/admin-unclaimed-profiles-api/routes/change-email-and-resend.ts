import { ERROR_IDS } from "../../constants/error-ids.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ChangeEmailAndResendResponse } from "../schemas/unclaimed-profile-schemas.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

interface ChangeEmailAndResendLogicParameters {
  oldEmail: string;
  newEmail: string;
  adminUid: string;
  unclaimedProfileAdminService: UnclaimedProfileAdminService;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}

export async function changeEmailAndResendLogic({
  oldEmail,
  newEmail,
  adminUid,
  unclaimedProfileAdminService,
  emailService,
  logger,
  set,
}: ChangeEmailAndResendLogicParameters): Promise<
  ChangeEmailAndResendResponse | { error: string }
> {
  try {
    const result = await unclaimedProfileAdminService.changeEmailAndResend({
      oldEmail,
      newEmail,
      emailService,
      logger,
    });

    logger.info("Admin changed email and resent invitation", {
      adminUid,
      oldEmail,
      newEmail,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "change email and resend invitation",
      errorId: ERROR_IDS.API_ADMIN_CHANGE_EMAIL_FAILED,
      logger,
      set,
      context: { oldEmail, newEmail, adminUid },
    });
  }
}
