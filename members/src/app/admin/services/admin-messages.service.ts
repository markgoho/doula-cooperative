import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import type { ListMessagesResponse, Message } from '../admin.types';

@Injectable({
  providedIn: 'root',
})
export class AdminMessagesService {
  private functions = inject(Functions);

  async listMessages(
    limit = 50,
    offset = 0,
    status: 'pending' | 'processed' | 'all' = 'all',
  ): Promise<ListMessagesResponse> {
    const listMessagesCallable = httpsCallable<
      { limit?: number; offset?: number; status?: 'pending' | 'processed' | 'all' },
      ListMessagesResponse
    >(this.functions, 'adminListMessages');

    const result = await listMessagesCallable({ limit, offset, status });
    return result.data;
  }

  async getMessage(id: string): Promise<Message> {
    const getMessageCallable = httpsCallable<{ id: string }, Message>(
      this.functions,
      'adminGetMessage',
    );

    const result = await getMessageCallable({ id });
    return result.data;
  }

  async updateMessageStatus(id: string, sent: boolean): Promise<{ success: boolean }> {
    const updateMessageCallable = httpsCallable<
      { id: string; sent: boolean },
      { success: boolean }
    >(this.functions, 'adminUpdateMessage');

    const result = await updateMessageCallable({ id, sent });
    return result.data;
  }
}

