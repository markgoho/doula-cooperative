import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type { ListMessagesResponse, Message } from '../admin.types';

@Injectable({
  providedIn: 'root',
})
export class AdminMessagesService {
  private readonly httpClient = inject(HttpClient);
  private readonly baseUrl = '/api/admin/messages';

  async listMessages(
    limit = 50,
    offset = 0,
    status: 'pending' | 'processed' | 'all' = 'all',
  ): Promise<ListMessagesResponse> {
    // Authorization header added automatically by authInterceptor
    const parameters = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString())
      .set('status', status);

    return firstValueFrom(
      this.httpClient.get<ListMessagesResponse>(this.baseUrl, { params: parameters }),
    );
  }

  async getMessage(id: string): Promise<Message> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(this.httpClient.get<Message>(`${this.baseUrl}/${id}`));
  }

  async updateMessageStatus(id: string, sent: boolean): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.patch<{ success: boolean }>(`${this.baseUrl}/${id}`, { sent }),
    );
  }
}
