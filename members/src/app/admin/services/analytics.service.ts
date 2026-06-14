import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  CostOffsetRateResponse,
  MatchRequestLocationsResponse,
  MemberSignupsResponse,
  TopPagesResponse,
} from '../api-types/analytics-api.types';

@Injectable({
  providedIn: 'root',
})
export class AnalyticsService {
  private readonly http = inject(HttpClient);
  private readonly base = '/api/analytics';

  getMemberSignups(): Promise<MemberSignupsResponse> {
    return firstValueFrom(
      this.http.get<MemberSignupsResponse>(`${this.base}/member-signups`),
    );
  }

  getCostOffsetRate(): Promise<CostOffsetRateResponse> {
    return firstValueFrom(
      this.http.get<CostOffsetRateResponse>(`${this.base}/cost-offset-rate`),
    );
  }

  getMatchRequestLocations(): Promise<MatchRequestLocationsResponse> {
    return firstValueFrom(
      this.http.get<MatchRequestLocationsResponse>(
        `${this.base}/match-request-locations`,
      ),
    );
  }

  getTopPages(): Promise<TopPagesResponse> {
    return firstValueFrom(
      this.http.get<TopPagesResponse>(`${this.base}/top-pages`),
    );
  }
}
