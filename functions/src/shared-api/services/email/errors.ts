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
 * Uses HTTP status codes for reliable error classification.
 * Falls back to message inspection for network-level errors.
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

  // Check for HTTP status code (Mailgun API errors have status or statusCode)
  const errorWithStatus = error as Error & { status?: number; statusCode?: number };
  const statusCode = errorWithStatus.status ?? errorWithStatus.statusCode;

  if (statusCode !== undefined) {
    switch (statusCode) {
      case 401:
      case 403: {
        return new EmailAuthError(`${baseMessage}: Authentication failed`);
      }

      case 404: {
        return new EmailDomainError(`${baseMessage}: Domain not configured`);
      }

      case 429: {
        return new EmailRateLimitError(`${baseMessage}: Rate limit exceeded`);
      }

      case 400: {
        // 400 typically indicates invalid recipient or malformed request
        return new EmailInvalidRecipientError(`${baseMessage}: Invalid recipient`);
      }

      case 503:
      case 504: {
        // Service unavailable or gateway timeout - retryable
        return new EmailNetworkError(`${baseMessage}: Service temporarily unavailable`);
      }
    }
  }

  // Check for network-level errors by error code (not HTTP status)
  const errorWithCode = error as Error & { code?: string };
  if (errorWithCode.code) {
    const networkErrorCodes = ["ETIMEDOUT", "ECONNREFUSED", "ENOTFOUND", "ECONNRESET", "ENETUNREACH"];
    if (networkErrorCodes.includes(errorWithCode.code)) {
      return new EmailNetworkError(`${baseMessage}: Network error - ${error.message}`);
    }
  }

  // Fall back to message inspection only as last resort
  const errorMessage = error.message.toLowerCase();

  if (errorMessage.includes("unauthorized") || errorMessage.includes("forbidden")) {
    return new EmailAuthError(`${baseMessage}: Authentication failed`);
  }

  if (errorMessage.includes("rate limit")) {
    return new EmailRateLimitError(`${baseMessage}: Rate limit exceeded`);
  }

  // Default to retryable for unknown errors (safer than assuming permanent failure)
  return new EmailError(`${baseMessage}: ${error.message}`, true);
}
