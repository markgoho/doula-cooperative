import { verifyRecaptchaToken } from "./verify-token.js";

export const RecaptchaService = {
  verifyToken: verifyRecaptchaToken,
};

// Re-export for direct imports

export type { RecaptchaVerification, RecaptchaVerifyResponse } from "./types.js";