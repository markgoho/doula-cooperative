import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { AnalyticsService } from "../services/interface.js";

export const SERVICE_KEYS = {
  ANALYTICS_SERVICE: "analyticsService",
  AUTH_SERVICE: "authService",
  LOGGER: "logger",
} as const;

export interface Services {
  [SERVICE_KEYS.ANALYTICS_SERVICE]: AnalyticsService;
  [SERVICE_KEYS.AUTH_SERVICE]: AuthService;
  [SERVICE_KEYS.LOGGER]: Logger;
}

export type PartialServices = Partial<Services>;
