import { Injectable, computed, inject, resource, signal, type Signal } from '@angular/core';
import { AdminMembersService } from '../../services/admin-members.service';

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
  readonly deleteInProgress = signal(false);

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
      const result = await this.adminMembersService.sendInvitation(email);
      // Show warning if tracking failed, otherwise show success
      this.successMessage.set(result.warning ?? 'Invitation sent successfully');
      this.unclaimedProfileResource.reload(); // Reload to get updated invitation status
    } catch (error) {
      console.error('Error sending invitation:', error);
      this.actionError.set('Failed to send invitation.');
    } finally {
      this.actionInProgress.set(false);
    }
  }

  /**
   * Delete the unclaimed profile
   */
  async deleteProfile(email: string): Promise<void> {
    this.deleteInProgress.set(true);
    this.actionError.set(undefined);

    try {
      await this.adminMembersService.deleteUnclaimedProfile(email);
      // Success - component will handle navigation
    } catch (error) {
      console.error('Error deleting unclaimed profile:', error);
      this.actionError.set('Failed to delete profile.');
      throw error; // Re-throw so component knows it failed
    } finally {
      this.deleteInProgress.set(false);
    }
  }

  /**
   * Change the email on an unclaimed profile and resend the invitation.
   * Returns the new email on success so the component can navigate to the new URL.
   */
  async changeEmailAndResend(oldEmail: string, newEmail: string): Promise<string | undefined> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      const result = await this.adminMembersService.changeEmailAndResend(oldEmail, newEmail);
      this.successMessage.set(
        result.warning ?? `Email changed to ${newEmail} and invitation resent successfully`,
      );
      return newEmail;
    } catch (error) {
      console.error('Error changing email and resending invitation:', error);
      this.actionError.set('Failed to change email and resend invitation.');
      return undefined;
    } finally {
      this.actionInProgress.set(false);
    }
  }

  /**
   * Update the email on an unclaimed profile (pre-invitation only).
   * Returns the new email on success so the component can navigate to the new URL.
   */
  async updateEmail(oldEmail: string, newEmail: string): Promise<string | undefined> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      await this.adminMembersService.updateEmail(oldEmail, newEmail);
      this.successMessage.set(`Email updated to ${newEmail}`);
      return newEmail;
    } catch (error) {
      console.error('Error updating email:', error);
      this.actionError.set('Failed to update email.');
      return undefined;
    } finally {
      this.actionInProgress.set(false);
    }
  }
}
