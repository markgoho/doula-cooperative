import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { UpdateMessageResponse } from "../schemas/message-schemas.js";
import type { MessageAdminService } from "../services/interface.js";

export async function updateMessageLogic({
  messageId,
  sent,
  adminUid,
  messageAdminService,
  logger,
  set,
}: {
  messageId: string;
  sent: boolean;
  adminUid: string;
  messageAdminService: MessageAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<UpdateMessageResponse | { error: string }> {
  try {
    const result = await messageAdminService.updateMessage({
      messageId,
      sent,
      logger,
    });

    logger.info("Admin updated message", {
      adminUid,
      messageId,
      sent,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "update message",
      errorId: ERROR_IDS.API_ADMIN_UPDATE_MESSAGE_FAILED,
      logger,
      set,
      context: { messageId, sent, adminUid },
    });
  }
}
