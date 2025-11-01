import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private functions = inject(Functions);
  private authService = inject(AuthService);

  // Expose admin status from AuthService
  readonly isAdmin = this.authService.isAdmin;

  /**
   * Grant admin privileges to a user by UID
   */
  async setAdminClaim(uid: string): Promise<void> {
    const setAdminClaimCallable = httpsCallable<{ uid: string }, { success: boolean }>(
      this.functions,
      'setAdminClaim',
    );

    try {
      await setAdminClaimCallable({ uid });
    } catch (error) {
      console.error('Error setting admin claim:', error);
      throw error;
    }
  }

  /**
   * Revoke admin privileges from a user by UID
   */
  async removeAdminClaim(uid: string): Promise<void> {
    const removeAdminClaimCallable = httpsCallable<{ uid: string }, { success: boolean }>(
      this.functions,
      'removeAdminClaim',
    );

    try {
      await removeAdminClaimCallable({ uid });
    } catch (error) {
      console.error('Error removing admin claim:', error);
      throw error;
    }
  }

  /**
   * Refresh the current user's ID token to get updated claims
   * Call this after granting/revoking admin status to reflect changes
   */
  async refreshAdminStatus(): Promise<void> {
    await this.authService.reloadUser();
  }
}
