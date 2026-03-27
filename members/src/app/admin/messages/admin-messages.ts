import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AdminMessagesStateService } from '../state/admin-messages-state.service';
import { MessagesTable } from './messages-table/messages-table';

@Component({
  imports: [MessagesTable],
  templateUrl: './admin-messages.html',
  styleUrl: './admin-messages.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMessages {
  private messagesState = inject(AdminMessagesStateService);

  protected messagesResource = this.messagesState.messagesResource;

  constructor() {
    this.messagesState.initialize();
  }

  protected totalMessages = computed(() => {
    return this.messagesResource.hasValue() ? (this.messagesResource.value()?.total ?? 0) : 0;
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
