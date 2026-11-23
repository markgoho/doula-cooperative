import { HttpClient } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ReferralPortalSettings } from '../api-types/admin-settings-api.types';

@Service()
export class AdminSettingsService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = '/api/admin/settings';

  async getReferralPortalSettings(): Promise<ReferralPortalSettings> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.get<ReferralPortalSettings>(`${this.baseUrl}/referral-portal`),
    );
  }

  async updateReferralPortalSettings(isEnabled: boolean): Promise<ReferralPortalSettings> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.patch<ReferralPortalSettings>(`${this.baseUrl}/referral-portal`, {
        v2Enabled: isEnabled,
      }),
    );
  }
}
