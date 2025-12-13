import type { MemberService } from "../services/member-service.js";
import type { AuthService } from "../services/auth-service.js";

/**
 * Service keys used for dependency injection.
 * Using constants prevents typos and enables refactoring.
 */
export const SERVICE_KEYS = {
  MEMBER_SERVICE: "memberService",
  AUTH_SERVICE: "authService",
} as const;

/**
 * Type for the services container.
 * Used in createApp() and route handler type signatures.
 */
export interface Services {
  [SERVICE_KEYS.MEMBER_SERVICE]: typeof MemberService;
  [SERVICE_KEYS.AUTH_SERVICE]: typeof AuthService;
}

/**
 * Partial services for testing (all services optional).
 */
export type PartialServices = Partial<Services>;
