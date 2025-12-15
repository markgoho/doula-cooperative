import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from './auth.service';

@Injectable({
  providedIn: 'root',
})
export class AdminService {
  private httpClient = inject(HttpClient);
  private authService = inject(AuthService);

  // Expose admin status from AuthService
  readonly isAdmin = this.authService.isAdmin;

  /**
   * Grant admin privileges to a user by UID
   */
  async setAdminClaim(uid: string): Promise<void> {
    // Authorization header added automatically by authInterceptor
    await firstValueFrom(
      this.httpClient.patch<{ success: boolean; uid: string }>(
        `/api/admin/members/${uid}/claims`,
        { admin: true },
      ),
    );
  }

  /**
   * Revoke admin privileges from a user by UID
   */
  async removeAdminClaim(uid: string): Promise<void> {
    // Authorization header added automatically by authInterceptor
    await firstValueFrom(
      this.httpClient.patch<{ success: boolean; uid: string }>(
        `/api/admin/members/${uid}/claims`,
        { admin: false },
      ),
    );
  }

  /**
   * Refresh the current user's ID token to get updated claims
   * Call this after granting/revoking admin status to reflect changes
   */
  async refreshAdminStatus(): Promise<void> {
    await this.authService.reloadUser();
  }
}
