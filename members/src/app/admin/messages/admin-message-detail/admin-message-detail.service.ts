import { Injectable, computed, inject, resource, signal, type Signal } from '@angular/core';
import { AdminMessagesService } from '../../services/admin-messages.service';
import { AdminMessagesStateService } from '../../state/admin-messages-state.service';

@Injectable()
export class AdminMessageDetailService {
  private adminMessagesService = inject(AdminMessagesService);
  private messagesState = inject(AdminMessagesStateService);

  // Signal for the current message id (set from component input)
  private idSignal = signal<Signal<string> | undefined>(undefined);

  // Resource automatically loads message based on id
  readonly messageResource = resource({
    params: () => {
      const idSignal = this.idSignal();
      return idSignal ? { id: idSignal() } : undefined;
    },
    loader: ({ params }) => this.adminMessagesService.getMessage(params.id),
  });

  // Transform error to string for display
  readonly errorMessage = computed(() => {
    const error = this.messageResource.error();
    return error ? 'Failed to load message details. Please try again.' : undefined;
  });

  // Action state signals
  readonly actionInProgress = signal(false);
  readonly successMessage = signal<string | undefined>(undefined);
  readonly actionError = signal<string | undefined>(undefined);

  /**
   * Initialize the service with the message id signal from component input
   */
  init(idSignal: Signal<string>): void {
    this.idSignal.set(idSignal);
  }

  /**
   * Update the status (sent field) of the message
   */
  async updateStatus(id: string, wasSent: boolean): Promise<void> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      await this.adminMessagesService.updateMessageStatus(id, wasSent);
      this.successMessage.set(`Message marked as ${wasSent ? 'processed' : 'pending'}`);
      this.messageResource.reload();
      this.messagesState.invalidate();
    } catch (error) {
      console.error('Error updating message status:', error);
      this.actionError.set('Failed to update message status.');
    } finally {
      this.actionInProgress.set(false);
    }
  }
}
