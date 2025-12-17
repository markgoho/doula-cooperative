import { ERROR_IDS } from "../../constants/error-ids.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { SendInvitationResponse } from "../schemas/unclaimed-profile-schemas.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

interface SendInvitationLogicParameters {
  email: string;
  adminUid: string;
  unclaimedProfileAdminService: UnclaimedProfileAdminService;
  emailService: EmailServiceInterface;
  logger: Logger;
  set: { status?: number | string };
}

export async function sendInvitationLogic({
  email,
  adminUid,
  unclaimedProfileAdminService,
  emailService,
  logger,
  set,
}: SendInvitationLogicParameters): Promise<
  SendInvitationResponse | { error: string }
> {
  try {
    const result = await unclaimedProfileAdminService.sendInvitation({
      email,
      emailService,
      logger,
    });

    logger.info("Admin sent invitation to unclaimed profile", {
      adminUid,
      email,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "send invitation",
      errorId: ERROR_IDS.ADMIN_SEND_INVITATION_EMAIL_FAILED,
      logger,
      set,
      context: { email, adminUid },
    });
  }
}
