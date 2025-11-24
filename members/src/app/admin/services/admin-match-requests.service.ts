import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import type { ListMatchRequestsResponse, MatchRequest } from '../admin.types';

@Injectable({
  providedIn: 'root',
})
export class AdminMatchRequestsService {
  private functions = inject(Functions);

  async listMatchRequests(
    limit = 50,
    offset = 0,
    status: 'pending' | 'processed' | 'all' = 'all',
  ): Promise<ListMatchRequestsResponse> {
    const listMatchRequestsCallable = httpsCallable<
      { limit?: number; offset?: number; status?: 'pending' | 'processed' | 'all' },
      ListMatchRequestsResponse
    >(this.functions, 'adminListMatchRequests');

    const result = await listMatchRequestsCallable({ limit, offset, status });
    return result.data;
  }

  async getMatchRequest(id: string): Promise<MatchRequest> {
    const getMatchRequestCallable = httpsCallable<{ id: string }, MatchRequest>(
      this.functions,
      'adminGetMatchRequest',
    );

    const result = await getMatchRequestCallable({ id });
    return result.data;
  }

  async updateMatchRequestStatus(id: string, sent: boolean): Promise<{ success: boolean }> {
    const updateMatchRequestCallable = httpsCallable<
      { id: string; sent: boolean },
      { success: boolean }
    >(this.functions, 'adminUpdateMatchRequest');

    const result = await updateMatchRequestCallable({ id, sent });
    return result.data;
  }
}

