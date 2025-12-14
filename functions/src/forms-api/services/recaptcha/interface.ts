import type { Logger } from "../../../shared-api/types/logger.js";
import type { RecaptchaVerification } from "./types.js";

/**
 * Service interface for reCAPTCHA verification operations.
 * Defines the contract for verifying reCAPTCHA tokens with Google's API.
 */
export interface RecaptchaService {
  /**
   * Verify a reCAPTCHA token with Google's API.
   *
   * @param options - Verification parameters
   * @returns Verification result with success status and score
   */
  verifyToken(options: {
    token: string;
    secretKey: string;
    logger: Logger;
  }): Promise<RecaptchaVerification>;
}
