import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { AdminMessagesService } from '../services/admin-messages.service';
import { MessagesTable } from './messages-table/messages-table';

@Component({
  imports: [MessagesTable],
  templateUrl: './admin-messages.html',
  styleUrl: './admin-messages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMessages {
  private adminMessagesService = inject(AdminMessagesService);

  protected messagesResource = resource({
    loader: () => this.adminMessagesService.listMessages(100, 0, 'all'),
  });

  protected totalMessages = computed(() => {
    return this.messagesResource.hasValue()
      ? (this.messagesResource.value()?.total ?? 0)
      : 0;
  });

  protected pendingCount = computed(() => {
    return this.messagesResource.hasValue()
      ? (this.messagesResource.value()?.pendingCount ?? 0)
      : 0;
  });

  protected processedCount = computed(() => {
    return this.messagesResource.hasValue()
      ? (this.messagesResource.value()?.processedCount ?? 0)
      : 0;
  });
}
