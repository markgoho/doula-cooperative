import { getAuth } from "firebase-admin/auth";
import type { VerifyEmailService } from "./interface.js";

/**
 * Real implementation of VerifyEmailService using Firebase Admin SDK.
 */
export const VerifyEmailServiceImpl: VerifyEmailService = {
  async markEmailVerified(uid: string): Promise<void> {
    await getAuth().updateUser(uid, { emailVerified: true });
  },
};
