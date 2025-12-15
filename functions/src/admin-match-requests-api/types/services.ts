import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { MatchRequestAdminService } from "../services/interface.js";

export const SERVICE_KEYS = {
  MATCH_REQUEST_ADMIN_SERVICE: "matchRequestAdminService",
  AUTH_SERVICE: "authService",
  LOGGER: "logger",
} as const;

export interface Services {
  [SERVICE_KEYS.MATCH_REQUEST_ADMIN_SERVICE]: MatchRequestAdminService;
  [SERVICE_KEYS.AUTH_SERVICE]: AuthService;
  [SERVICE_KEYS.LOGGER]: Logger;
}

export type PartialServices = Partial<Services>;
