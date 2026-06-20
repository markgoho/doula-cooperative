import { HttpError } from "./http-error.js";

/**
 * 400 Bad Request - Invalid or missing Stripe webhook signature.
 */
export class StripeSignatureError extends HttpError {
  constructor(message: string) {
    super(message, 400);
  }
}

/**
 * 500 Internal Server Error - Stripe configuration is missing or invalid.
 */
export class StripeConfigError extends HttpError {
  constructor(message: string) {
    super(message, 500);
  }
}

/**
 * Stripe webhook processing error with configurable status code.
 * Defaults to 500 Internal Server Error for critical failures.
 * Use 500 for failures that should trigger Stripe retry.
 * Use 400 for invalid webhook data that should not be retried.
 */
export class StripeWebhookError extends HttpError {
  constructor(message: string, statusCode = 500) {
    super(message, statusCode);
  }
}
