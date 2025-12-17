/**
 * Service interface for Firebase Auth user updates in profile operations.
 * Abstracts Auth operations to enable testing without emulators.
 */
export interface AuthUpdateService {
  /**
   * Update a user's display name in Firebase Auth.
   * @param uid - The user ID
   * @param displayName - The new display name to set
   */
  updateDisplayName(uid: string, displayName: string): Promise<void>;
}
