import type { AuthService } from "@doula-coop/functions-shared/shared-api/services/auth/interface.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import type { MessageAdminService } from "../services/interface.js";

export const SERVICE_KEYS = {
  MESSAGE_ADMIN_SERVICE: "messageAdminService",
  AUTH_SERVICE: "authService",
  LOGGER: "logger",
} as const;

export interface Services {
  [SERVICE_KEYS.MESSAGE_ADMIN_SERVICE]: MessageAdminService;
  [SERVICE_KEYS.AUTH_SERVICE]: AuthService;
  [SERVICE_KEYS.LOGGER]: Logger;
}

export type PartialServices = Partial<Services>;
