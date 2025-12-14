/**
 * Custom error classes for email service failures.
 */

/**
 * Base error class for email-related errors.
 */
export class EmailError extends Error {
  constructor(
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

/**
 * Error thrown when Mailgun authentication fails.
 */
export class EmailAuthError extends EmailError {
  constructor(message: string) {
    super(message, false);
  }
}

/**
 * Error thrown when email domain is not configured.
 */
export class EmailDomainError extends EmailError {
  constructor(message: string) {
    super(message, false);
  }
}

/**
 * Error thrown when hitting rate limits.
 */
export class EmailRateLimitError extends EmailError {
  constructor(message: string) {
    super(message, true);
  }
}

/**
 * Error thrown for invalid recipients.
 */
export class EmailInvalidRecipientError extends EmailError {
  constructor(message: string) {
    super(message, false);
  }
}

/**
 * Error thrown for network-related issues.
 */
export class EmailNetworkError extends EmailError {
  constructor(message: string) {
    super(message, true);
  }
}

/**
 * Parse Mailgun error and return appropriate typed error.
 *
 * @param error - The original error from Mailgun
 * @param emailTo - The recipient email address(es)
 * @returns Typed email error with appropriate retry flag
 */
export function parseMailgunError(error: unknown, emailTo: string): EmailError {
  const baseMessage = `Failed to send email to ${emailTo}`;

  if (!(error instanceof Error)) {
    return new EmailError(`${baseMessage}: Unknown error`, false);
  }

  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes("unauthorized") || errorMessage.includes("forbidden")) {
    return new EmailAuthError(`${baseMessage}: Authentication failed`);
  }

  if (errorMessage.includes("not found") || errorMessage.includes("domain")) {
    return new EmailDomainError(`${baseMessage}: Domain not configured`);
  }

  if (errorMessage.includes("rate limit")) {
    return new EmailRateLimitError(`${baseMessage}: Rate limit exceeded`);
  }

  if (errorMessage.includes("invalid") || errorMessage.includes("recipient")) {
    return new EmailInvalidRecipientError(`${baseMessage}: Invalid recipient`);
  }

  if (
    errorMessage.includes("timeout") ||
    errorMessage.includes("network") ||
    errorMessage.includes("econnrefused") ||
    errorMessage.includes("enotfound")
  ) {
    return new EmailNetworkError(`${baseMessage}: Network error - ${error.message}`);
  }

  return new EmailError(`${baseMessage}: ${error.message}`, false);
}
