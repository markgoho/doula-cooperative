import type { Logger } from "../../types/logger.js";
import type { SendEmailParameters } from "./types.js";

/**
 * Service interface for email operations.
 * Defines the contract for sending emails via Mailgun.
 */
export interface EmailService {
  /**
   * Send an email via Mailgun.
   *
   * @param parameters - Email message and Mailgun API key
   * @param logger - Logger instance for error reporting
   */
  sendEmail(
    parameters: SendEmailParameters,
    logger: Logger,
  ): Promise<void>;
}
