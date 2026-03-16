import type { AuthService } from "@doula-coop/functions-shared/shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "@doula-coop/functions-shared/shared-api/services/email/index.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import type { UnclaimedProfileAdminService } from "../services/interface.js";

export const SERVICE_KEYS = {
  UNCLAIMED_PROFILE_ADMIN_SERVICE: "unclaimedProfileAdminService",
  AUTH_SERVICE: "authService",
  EMAIL_SERVICE: "emailService",
  LOGGER: "logger",
} as const;

export interface Services {
  [SERVICE_KEYS.UNCLAIMED_PROFILE_ADMIN_SERVICE]: UnclaimedProfileAdminService;
  [SERVICE_KEYS.AUTH_SERVICE]: AuthService;
  [SERVICE_KEYS.EMAIL_SERVICE]: EmailServiceInterface;
  [SERVICE_KEYS.LOGGER]: Logger;
}

export type PartialServices = Partial<Services>;
