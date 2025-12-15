import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

export const SERVICE_KEYS = {
  UNCLAIMED_PROFILE_ADMIN_SERVICE: "unclaimedProfileAdminService",
  AUTH_SERVICE: "authService",
  LOGGER: "logger",
} as const;

export interface Services {
  [SERVICE_KEYS.UNCLAIMED_PROFILE_ADMIN_SERVICE]: UnclaimedProfileAdminService;
  [SERVICE_KEYS.AUTH_SERVICE]: AuthService;
  [SERVICE_KEYS.LOGGER]: Logger;
}

export type PartialServices = Partial<Services>;
