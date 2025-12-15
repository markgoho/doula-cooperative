import { getMessage } from "./get-message.js";
import { listMessages } from "./list-messages.js";
import { updateMessage } from "./update-message.js";

/**
 * Service object for admin message management operations.
 * Exported as a plain object following the pattern from admin-members-api.
 */
export const MessageAdminService = {
  listMessages,
  getMessage,
  updateMessage,
};

// Re-export individual functions for direct imports
export { getMessage } from "./get-message.js";
export { listMessages } from "./list-messages.js";
export { updateMessage } from "./update-message.js";
