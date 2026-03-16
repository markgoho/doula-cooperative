import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import { handleRouteError } from "@doula-coop/functions-shared/shared-api/utils/route-error-handler.js";
import type { MessageResponse } from "../schemas/message-schemas.js";
import type { MessageAdminService } from "../services/interface.js";

export async function getMessageLogic({
  messageId,
  adminUid,
  messageAdminService,
  logger,
  set,
}: {
  messageId: string;
  adminUid: string;
  messageAdminService: MessageAdminService;
  logger: Logger;
  set: { status?: number | string };
}): Promise<MessageResponse | { error: string }> {
  try {
    const result = await messageAdminService.getMessage({
      messageId,
      logger,
    });

    logger.info("Admin retrieved message", { adminUid, messageId });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "get message",
      errorId: ERROR_IDS.API_ADMIN_GET_MESSAGE_FAILED,
      logger,
      set,
      context: { messageId, adminUid },
    });
  }
}
