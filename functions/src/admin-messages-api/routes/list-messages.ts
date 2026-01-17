import { ERROR_IDS } from "../../constants/error-ids.js";
import type { Logger } from "../../shared-api/types/logger.js";
import { handleRouteError } from "../../shared-api/utils/route-error-handler.js";
import type { ListMessagesResponse } from "../schemas/message-schemas.js";
import type { MessageAdminService } from "../services/interface.js";
import type { MessageStatus } from "../services/list-messages.js";

interface ListMessagesLogicParameters {
  limit?: number;
  offset?: number;
  status?: MessageStatus;
  adminUid: string;
  messageAdminService: MessageAdminService;
  logger: Logger;
  set: { status?: number | string };
}

export async function listMessagesLogic({
  limit,
  offset,
  status,
  adminUid,
  messageAdminService,
  logger,
  set,
}: ListMessagesLogicParameters): Promise<
  ListMessagesResponse | { error: string }
> {
  try {
    const result = await messageAdminService.listMessages({
      ...(limit !== undefined && { limit }),
      ...(offset !== undefined && { offset }),
      ...(status !== undefined && { status }),
      logger,
    });

    logger.info("Admin listed messages", {
      adminUid,
      resultCount: result.messages.length,
      status,
      total: result.total,
      pendingCount: result.pendingCount,
      processedCount: result.processedCount,
    });

    return result;
  } catch (error: unknown) {
    return handleRouteError({
      error,
      operation: "list messages",
      errorId: ERROR_IDS.API_ADMIN_LIST_MESSAGES_FAILED,
      logger,
      set,
      context: { limit, offset, status, adminUid },
    });
  }
}
