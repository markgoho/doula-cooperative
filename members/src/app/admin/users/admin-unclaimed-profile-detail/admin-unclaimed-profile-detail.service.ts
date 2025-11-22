import { Injectable, computed, inject, resource, signal, type Signal } from '@angular/core';
import { AdminMembersService } from '../../admin.service';

@Injectable()
export class AdminUnclaimedProfileDetailService {
  private adminMembersService = inject(AdminMembersService);

  // Signal for the current unclaimed profile email (set from component input)
  private emailSignal!: Signal<string>;

  // Resource automatically loads unclaimed profile based on email
  readonly unclaimedProfileResource = resource({
    params: () => ({ email: this.emailSignal() }),
    loader: ({ params }) => this.adminMembersService.getUnclaimedProfile(params.email),
  });

  // Transform error to string for display
  readonly errorMessage = computed(() => {
    const error = this.unclaimedProfileResource.error();
    return error ? 'Failed to load unclaimed profile details. Please try again.' : undefined;
  });

  // Action state signals
  readonly actionInProgress = signal(false);
  readonly successMessage = signal<string | undefined>(undefined);
  readonly actionError = signal<string | undefined>(undefined);

  /**
   * Initialize the service with the email signal from component input
   */
  init(emailSignal: Signal<string>): void {
    this.emailSignal = emailSignal;
  }

  /**
   * Send invitation to the unclaimed profile
   */
  async sendInvitation(email: string): Promise<void> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      await this.adminMembersService.sendInvitation(email);
      this.successMessage.set('Invitation sent successfully');
      this.unclaimedProfileResource.reload(); // Reload to get updated invitation status
    } catch (error) {
      console.error('Error sending invitation:', error);
      this.actionError.set('Failed to send invitation.');
    } finally {
      this.actionInProgress.set(false);
    }
  }
}
