import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ListMatchRequestsResponse, MatchRequest } from '../admin.types';

@Service()
export class AdminMatchRequestsService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = '/api/admin/match-requests';

  async listMatchRequests(
    limit = 50,
    offset = 0,
    status: 'pending' | 'processed' | 'all' = 'all',
  ): Promise<ListMatchRequestsResponse> {
    // Authorization header added automatically by authInterceptor
    const parameters = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString())
      .set('status', status);

    return firstValueFrom(
      this.httpClient.get<ListMatchRequestsResponse>(this.baseUrl, { params: parameters }),
    );
  }

  async getMatchRequest(id: string): Promise<MatchRequest> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(this.httpClient.get<MatchRequest>(`${this.baseUrl}/${id}`));
  }

  async updateMatchRequestStatus(id: string, wasSent: boolean): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.patch<{ success: boolean }>(`${this.baseUrl}/${id}`, { sent: wasSent }),
    );
  }
}
