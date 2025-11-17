import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { AdminMembersService, type UnclaimedProfile } from '../admin.service';

@Component({
  imports: [DatePipe],
  templateUrl: './admin-unclaimed-profile-detail.html',
  styleUrl: './admin-unclaimed-profile-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUnclaimedProfileDetail {
  private adminMembersService = inject(AdminMembersService);

  // Route parameter binding (enabled via withComponentInputBinding)
  email = input.required<string>();

  protected unclaimedProfile = signal<UnclaimedProfile | undefined>(undefined);
  protected loading = signal(true);
  protected error = signal<string | undefined>(undefined);
  protected actionInProgress = signal(false);
  protected successMessage = signal<string | undefined>(undefined);

  protected invitationAlreadySent = computed(() => {
    const unclaimed = this.unclaimedProfile();
    return unclaimed?.invitationEmailStatus === 'sent';
  });

  constructor() {
    effect(() => {
      const currentEmail = this.email();
      if (currentEmail) {
        void this.loadUnclaimedProfile();
      }
    });
  }

  private async loadUnclaimedProfile(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);
    this.unclaimedProfile.set(undefined);

    try {
      const profile = await this.adminMembersService.getUnclaimedProfile(this.email());
      this.unclaimedProfile.set(profile);
    } catch (error) {
      console.error('Error loading unclaimed profile:', error);
      this.error.set('Failed to load unclaimed profile details. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected async sendInvitation(): Promise<void> {
    const email = this.email();

    this.actionInProgress.set(true);
    this.error.set(undefined);
    this.successMessage.set(undefined);

    try {
      await this.adminMembersService.sendInvitation(email);
      this.successMessage.set('Invitation sent successfully');
      await this.loadUnclaimedProfile(); // Reload to get updated invitation status
    } catch (error) {
      console.error('Error sending invitation:', error);
      this.error.set('Failed to send invitation.');
    } finally {
      this.actionInProgress.set(false);
    }
  }
}
