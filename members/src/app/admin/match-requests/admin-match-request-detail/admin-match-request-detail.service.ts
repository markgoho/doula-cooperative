import { Injectable, computed, inject, resource, signal, type Signal } from '@angular/core';
import { AdminMatchRequestsService } from '../../admin.service';

@Injectable()
export class AdminMatchRequestDetailService {
  private adminMatchRequestsService = inject(AdminMatchRequestsService);

  // Signal for the current match request id (set from component input)
  private idSignal!: Signal<string>;

  // Resource automatically loads match request based on id
  readonly matchRequestResource = resource({
    params: () => ({ id: this.idSignal() }),
    loader: ({ params }) => this.adminMatchRequestsService.getMatchRequest(params.id),
  });

  // Transform error to string for display
  readonly errorMessage = computed(() => {
    const error = this.matchRequestResource.error();
    return error ? 'Failed to load match request details. Please try again.' : undefined;
  });

  // Action state signals
  readonly actionInProgress = signal(false);
  readonly successMessage = signal<string | undefined>(undefined);
  readonly actionError = signal<string | undefined>(undefined);

  /**
   * Initialize the service with the id signal from component input
   */
  init(idSignal: Signal<string>): void {
    this.idSignal = idSignal;
  }

  /**
   * Update the status (sent field) of the match request
   */
  async updateStatus(id: string, sent: boolean): Promise<void> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      await this.adminMatchRequestsService.updateMatchRequestStatus(id, sent);
      this.successMessage.set(`Match request marked as ${sent ? 'processed' : 'pending'}`);
      this.matchRequestResource.reload(); // Reload to get updated data
    } catch (error) {
      console.error('Error updating match request status:', error);
      this.actionError.set('Failed to update match request status.');
    } finally {
      this.actionInProgress.set(false);
    }
  }
}
