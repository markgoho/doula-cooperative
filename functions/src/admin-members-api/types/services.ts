import type { Logger } from "../../shared-api/types/logger.js";
import type { MemberAdminService } from "../services/admin-member/interface.js";
import type { AuthService } from "../../shared-api/services/auth/interface.js";

/**
 * Service keys used for dependency injection via Elysia's decorate.
 * Constants ensure consistency between registration and usage.
 */
export const SERVICE_KEYS = {
  MEMBER_ADMIN_SERVICE: "memberAdminService",
  AUTH_SERVICE: "authService",
  LOGGER: "logger",
} as const;

/**
 * Type for the services container.
 * Used in createApp() and route handler type signatures.
 * Services are now defined as interfaces for better testability and decoupling.
 */
export interface Services {
  [SERVICE_KEYS.MEMBER_ADMIN_SERVICE]: MemberAdminService;
  [SERVICE_KEYS.AUTH_SERVICE]: AuthService;
  [SERVICE_KEYS.LOGGER]: Logger;
}

/**
 * Partial services for testing (all services optional).
 */
export type PartialServices = Partial<Services>;
