import type { AuthService } from "../../shared-api/services/auth/interface.js";
import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { MemberFirestoreService } from "../../shared-api/services/member-firestore/interface.js";
import type { ReferralPortalSettingsService } from "../../shared-api/services/referral-portal-settings/interface.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type { MemberService } from "../services/member/interface.js";
import type { NewsletterService } from "../services/newsletter/interface.js";
import type { OfflineResponseService } from "../services/offline-response/interface.js";
import type { OutreachService } from "../services/outreach/interface.js";
import type { ReferralOutcomeService } from "../services/referral-outcome/interface.js";
import type { ReferralsService } from "../services/referrals/interface.js";
import type { VerifyEmailService } from "../services/verify-email/interface.js";

/**
 * Service keys used for dependency injection via Elysia's decorate.
 * Constants ensure consistency between registration and usage.
 */
export const SERVICE_KEYS = {
  MEMBER_SERVICE: "memberService",
  AUTH_SERVICE: "authService",
  EMAIL_SERVICE: "emailService",
  LOGGER: "logger",
  NEWSLETTER_SERVICE: "newsletterService",
  VERIFY_EMAIL_SERVICE: "verifyEmailService",
  MEMBER_FIRESTORE_SERVICE: "memberFirestoreService",
  REFERRALS_SERVICE: "referralsService",
  REFERRAL_PORTAL_SETTINGS_SERVICE: "referralPortalSettingsService",
  OUTREACH_SERVICE: "outreachService",
  REFERRAL_OUTCOME_SERVICE: "referralOutcomeService",
  OFFLINE_RESPONSE_SERVICE: "offlineResponseService",
} as const;

/**
 * Type for the services container.
 * Used in createApp() and route handler type signatures.
 * Services are now defined as interfaces for better testability and decoupling.
 */
export interface Services {
  [SERVICE_KEYS.MEMBER_SERVICE]: MemberService;
  [SERVICE_KEYS.AUTH_SERVICE]: AuthService;
  [SERVICE_KEYS.EMAIL_SERVICE]: EmailServiceInterface;
  [SERVICE_KEYS.LOGGER]: Logger;
  [SERVICE_KEYS.NEWSLETTER_SERVICE]: NewsletterService;
  [SERVICE_KEYS.VERIFY_EMAIL_SERVICE]: VerifyEmailService;
  [SERVICE_KEYS.MEMBER_FIRESTORE_SERVICE]: MemberFirestoreService;
  [SERVICE_KEYS.REFERRALS_SERVICE]: ReferralsService;
  [SERVICE_KEYS.REFERRAL_PORTAL_SETTINGS_SERVICE]: ReferralPortalSettingsService;
  [SERVICE_KEYS.OUTREACH_SERVICE]: OutreachService;
  [SERVICE_KEYS.REFERRAL_OUTCOME_SERVICE]: ReferralOutcomeService;
  [SERVICE_KEYS.OFFLINE_RESPONSE_SERVICE]: OfflineResponseService;
}

/**
 * Partial services for testing (all services optional).
 */
export type PartialServices = Partial<Services>;
