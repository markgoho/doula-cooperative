import { ERROR_IDS } from "@doula-coop/functions-shared/constants/error-ids.js";
import type { Logger } from "@doula-coop/functions-shared/shared-api/types/logger.js";
import type {
  RecaptchaVerification,
  RecaptchaVerifyResponse,
} from "./types.js";

/**
 * Verify a reCAPTCHA token with Google's API.
 *
 * @param token - The reCAPTCHA token from the client
 * @param secretKey - The reCAPTCHA secret key from environment
 * @param logger - Logger instance for error tracking
 * @returns Verification result with success status and score
 */
export async function verifyRecaptchaToken({
  token,
  secretKey,
  logger,
}: {
  token: string;
  secretKey: string;
  logger: Logger;
}): Promise<RecaptchaVerification> {
  const parameters = new URLSearchParams();
  parameters.append("secret", secretKey);
  parameters.append("response", token);

  try {
    const response = await fetch(
      "https://www.google.com/recaptcha/api/siteverify",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: parameters,
      },
    );

    if (!response.ok) {
      logger.error("reCAPTCHA API returned error status", {
        errorId: ERROR_IDS.RECAPTCHA_API_ERROR,
        status: response.status,
        statusText: response.statusText,
      });
      return {
        success: false,
        score: 0,
        error: "recaptcha-api-error",
      };
    }

    const data = (await response.json()) as RecaptchaVerifyResponse;

    const error = data["error-codes"]?.[0];
    return {
      success: data.success,
      score: data.score ?? 0,
      ...(error !== undefined && { error }),
    };
  } catch (error) {
    logger.error("Failed to verify reCAPTCHA token", {
      errorId: ERROR_IDS.RECAPTCHA_NETWORK_ERROR,
      error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      actionRequired: "Check network connectivity to Google reCAPTCHA API",
    });

    // Return failure instead of throwing - allows form to fail gracefully
    return {
      success: false,
      score: 0,
      error: "network-error",
    };
  }
}
