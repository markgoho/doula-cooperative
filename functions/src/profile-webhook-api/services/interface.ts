import type { EmailServiceInterface } from "../../shared-api/services/email/index.js";
import type { Logger } from "../../shared-api/types/logger.js";
import type {
  MemberInfo,
  NotificationParameters,
  ValidationResult,
} from "./types.js";

/**
 * Service interface for profile webhook operations.
 * Defines the contract for processing profile deployment webhooks.
 */
export interface ProfileWebhookService {
  /**
   * Verify the webhook secret matches the expected value.
   *
   * @param options - Secret verification parameters
   * @returns True if secret is valid, false otherwise
   */
  verifySecret(options: { provided: string; expected: string }): boolean;

  /**
   * Validate the webhook payload structure and required fields.
   *
   * @param options - Payload to validate
   * @returns Validation result with success status and optional reason
   */
  validatePayload(options: {
    payload: {
      notificationType?: string;
      commitSha?: string;
      slug?: string;
    };
  }): ValidationResult;

  /**
   * Find a member by their profile slug.
   *
   * @param options - Slug and logger
   * @returns Member information if found, undefined otherwise
   */
  findMemberBySlug(options: {
    slug: string;
    logger: Logger;
  }): Promise<MemberInfo | undefined>;

  /**
   * Send notification email to member about profile update.
   *
   * @param options - Email notification parameters including injected email service
   */
  sendNotificationEmail(
    options: NotificationParameters & {
      emailService: EmailServiceInterface;
      logger: Logger;
    },
  ): Promise<void>;
}
