export interface VerifyEmailService {
  /**
   * Mark a user's email as verified in Firebase Auth.
   *
   * @param uid - The Firebase Auth UID of the user
   * @throws Error if the Firebase Admin SDK call fails
   */
  markEmailVerified(uid: string): Promise<void>;
}
