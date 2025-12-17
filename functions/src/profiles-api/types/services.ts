import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { ProfileGitHubService } from "../services/github/interface.js";
import type { ProfileMemberService } from "../services/member/interface.js";

/**
 * Service keys used for dependency injection via Elysia's decorate.
 * Constants ensure consistency between registration and usage.
 */
export const SERVICE_KEYS = {
  PROFILE_GITHUB_SERVICE: "profileGitHubService",
  PROFILE_MEMBER_SERVICE: "profileMemberService",
  AUTH_SERVICE: "authService",
  EMAIL_SERVICE: "emailService",
  LOGGER: "logger",
} as const;

/**
 * Type for the services container.
 * Used in createApp() and route handler type signatures.
 */
export interface Services {
  [SERVICE_KEYS.PROFILE_GITHUB_SERVICE]: ProfileGitHubService;
  [SERVICE_KEYS.PROFILE_MEMBER_SERVICE]: ProfileMemberService;
  [SERVICE_KEYS.AUTH_SERVICE]: AuthService;
  [SERVICE_KEYS.EMAIL_SERVICE]: EmailServiceInterface;
  [SERVICE_KEYS.LOGGER]: Logger;
}

/**
 * Partial services for testing (all services optional).
 */
export type PartialServices = Partial<Services>;
