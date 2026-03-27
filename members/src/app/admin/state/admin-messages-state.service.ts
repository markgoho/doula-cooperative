import { Injectable, inject, resource, signal } from '@angular/core';
import { AdminMessagesService } from '../services/admin-messages.service';

@Injectable({
  providedIn: 'root',
})
export class AdminMessagesStateService {
  private adminMessagesService = inject(AdminMessagesService);
  private initialized = signal(false);

  readonly messagesResource = resource({
    params: () => (this.initialized() ? {} : undefined),
    loader: () => this.adminMessagesService.listMessages(100, 0, 'all'),
  });

  initialize(): void {
    this.initialized.set(true);
  }

  invalidate(): void {
    this.messagesResource.reload();
  }
}
