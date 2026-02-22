export interface VerifyEmailService {
  markEmailVerified(uid: string): Promise<void>;
}
