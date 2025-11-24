import { Injectable, computed, inject, resource, signal } from '@angular/core';
import { AdminMessagesService } from '../../services/admin-messages.service';

@Injectable()
export class AdminMessageDetailService {
  private adminMessagesService = inject(AdminMessagesService);

  // Signal for the current message id (set from component via effect)
  readonly idSignal = signal<string>('');

  // Resource automatically loads message based on id
  readonly messageResource = resource({
    params: () => ({ id: this.idSignal() }),
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
   * Update the status (sent field) of the message
   */
  async updateStatus(id: string, sent: boolean): Promise<void> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      await this.adminMessagesService.updateMessageStatus(id, sent);
      this.successMessage.set(`Message marked as ${sent ? 'processed' : 'pending'}`);
      this.messageResource.reload(); // Reload to get updated data
    } catch (error) {
      console.error('Error updating message status:', error);
      this.actionError.set('Failed to update message status.');
    } finally {
      this.actionInProgress.set(false);
    }
  }
}
