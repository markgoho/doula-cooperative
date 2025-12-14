export interface RecaptchaVerifyResponse {
  success: boolean;
  score?: number;
  "error-codes"?: string[];
}

export interface RecaptchaVerification {
  success: boolean;
  score: number;
  error?: string;
}
