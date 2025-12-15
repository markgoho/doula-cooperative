import type { Logger } from "../../shared-api/types/logger.js";
import type {
  ListMessagesResponse,
  MessageResponse,
} from "../schemas/message-schemas.js";
import type { MessageStatus } from "./list-messages.js";

export interface MessageAdminService {
  listMessages(options: {
    limit?: number;
    offset?: number;
    status?: MessageStatus;
    logger: Logger;
  }): Promise<ListMessagesResponse>;

  getMessage(options: {
    messageId: string;
    logger: Logger;
  }): Promise<MessageResponse>;

  updateMessage(options: {
    messageId: string;
    sent: boolean;
    logger: Logger;
  }): Promise<{ success: true }>;
}
