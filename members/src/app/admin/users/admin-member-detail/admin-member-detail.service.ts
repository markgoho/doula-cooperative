import { Injectable, computed, inject, resource, signal, type Signal } from '@angular/core';
import type { Member } from '../../admin.types';
import { AdminMembersService } from '../../services/admin-members.service';

@Injectable()
export class AdminMemberDetailService {
  private adminMembersService = inject(AdminMembersService);

  // Signal for the current member uid (set from component input)
  private uidSignal!: Signal<string>;

  // Resource automatically loads member based on uid
  readonly memberResource = resource({
    params: () => ({ uid: this.uidSignal() }),
    loader: ({ params }) => this.adminMembersService.getMember(params.uid),
  });

  // Transform error to string for display
  readonly errorMessage = computed(() => {
    const error = this.memberResource.error();
    return error ? 'Failed to load member details. Please try again.' : undefined;
  });

  // Action state signals
  readonly actionInProgress = signal(false);
  readonly successMessage = signal<string | undefined>(undefined);
  readonly actionError = signal<string | undefined>(undefined);

  // Profile loading with resource API
  private profileUidSignal = signal<string | undefined>(undefined);

  readonly profileResource = resource({
    params: () => {
      const uid = this.profileUidSignal();
      return uid ? { uid } : undefined;
    },
    loader: ({ params }) => this.adminMembersService.readMemberProfile(params.uid),
  });

  readonly profileErrorMessage = computed(() => {
    const error = this.profileResource.error();
    return error ? 'Failed to load profile content. Please try again.' : undefined;
  });

  /**
   * Initialize the service with the uid signal from component input
   */
  init(uidSignal: Signal<string>): void {
    this.uidSignal = uidSignal;
  }

  /**
   * Activate membership for the current member
   */
  async activateMembership(uid: string): Promise<void> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      await this.adminMembersService.activateMembership(uid);
      this.successMessage.set('Membership activated successfully');
      this.memberResource.reload(); // Reload to get updated data
    } catch (error) {
      console.error('Error activating membership:', error);
      this.actionError.set('Failed to activate membership.');
    } finally {
      this.actionInProgress.set(false);
    }
  }

  /**
   * Cancel membership for the current member
   */
  async cancelMembership(uid: string): Promise<void> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      await this.adminMembersService.cancelMembership(uid);
      this.successMessage.set('Membership cancellation scheduled');
      this.memberResource.reload(); // Reload to get updated data
    } catch (error) {
      console.error('Error canceling membership:', error);
      this.actionError.set('Failed to cancel membership.');
    } finally {
      this.actionInProgress.set(false);
    }
  }

  /**
   * Delete user account
   */
  async deleteUser(uid: string): Promise<void> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      await this.adminMembersService.deleteUser(uid);
      this.successMessage.set('User deleted successfully');
      this.actionInProgress.set(false);
      // Note: Component should handle navigation after successful deletion
    } catch (error) {
      console.error('Error deleting user:', error);
      this.actionError.set('Failed to delete user.');
      this.actionInProgress.set(false);
    }
  }

  /**
   * Load profile content for the current member
   */
  loadProfile(member: Member): void {
    if (member.slug) {
      this.profileUidSignal.set(member.uid);
    }
  }

  /**
   * Refund membership for the current member
   */
  async refundMembership(uid: string): Promise<void> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      const result = await this.adminMembersService.refundMembership(uid);
      const warnings: string[] = [];

      if (result.refundResult.warning) {
        warnings.push(result.refundResult.warning);
      }

      const message =
        warnings.length > 0
          ? `Membership refunded successfully. Warning: ${warnings.join('; ')}`
          : 'Membership refunded successfully';

      this.successMessage.set(message);
      this.memberResource.reload();
    } catch (error) {
      console.error('Error refunding membership:', error);
      this.actionError.set('Failed to refund membership.');
    } finally {
      this.actionInProgress.set(false);
    }
  }

  /**
   * Clean slate delete: remove every trace of a user across all integrated systems
   */
  async cleanSlateDelete(uid: string): Promise<void> {
    this.actionInProgress.set(true);
    this.successMessage.set(undefined);
    this.actionError.set(undefined);

    try {
      const result = await this.adminMembersService.cleanSlateDelete(uid);

      const message = result.warning
        ? `User completely removed. Warning: ${result.warning}`
        : 'User completely removed from all systems';

      this.successMessage.set(message);
      this.actionInProgress.set(false);
      // Note: Component should handle navigation after successful deletion
    } catch (error) {
      console.error('Error performing clean slate delete:', error);
      this.actionError.set('Failed to perform clean slate delete.');
      this.actionInProgress.set(false);
    }
  }
}
