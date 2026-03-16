import type { Logger } from "../../types/logger.js";
import type { EmailMessage } from "./types.js";

/**
 * Service interface for email operations.
 * Defines the contract for sending emails via Mailgun.
 */
export interface EmailService {
  /**
   * Send an email via Mailgun.
   *
   * Reads MAILGUN_API_KEY from environment variables.
   *
   * @param parameters - Email message data
   * @param parameters.message - Email message (to, from, subject, html/text, etc.)
   * @param logger - Logger instance for error reporting
   * @throws Error if MAILGUN_API_KEY not configured
   * @throws Error if email sending fails
   */
  sendEmail(
    parameters: { message: EmailMessage },
    logger: Logger,
  ): Promise<void>;
}
