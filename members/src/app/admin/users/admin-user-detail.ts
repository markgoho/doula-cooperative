import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  effect,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminMembersService, type Member } from '../admin.service';

type ConfirmAction = 'activate' | 'deactivate';

@Component({
  imports: [RouterLink, DatePipe],
  templateUrl: './admin-user-detail.html',
  styleUrl: './admin-user-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUserDetail {
  private adminMembersService = inject(AdminMembersService);

  // Route parameter binding (enabled via withComponentInputBinding)
  uid = input.required<string>();

  protected member = signal<Member | undefined>(undefined);
  protected loading = signal(true);
  protected error = signal<string | undefined>(undefined);
  protected actionInProgress = signal(false);
  protected successMessage = signal<string | undefined>(undefined);
  protected confirmDialog = viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');
  protected pendingAction = signal<ConfirmAction | undefined>(undefined);
  protected profileContent = signal<{ content: string; image?: string; slug: string } | undefined>(
    undefined,
  );
  protected loadingProfile = signal(false);
  protected profileError = signal<string | undefined>(undefined);

  constructor() {
    effect(() => {
      // When uid changes, load the member
      const currentUid = this.uid();
      if (currentUid) {
        void this.loadMember();
      }
    });
  }

  private async loadMember(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);

    try {
      const member = await this.adminMembersService.getMember(this.uid());
      this.member.set(member);
    } catch (error) {
      console.error('Error loading member:', error);
      this.error.set('Failed to load member details. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }

  protected showActivateConfirm(): void {
    this.pendingAction.set('activate');
    this.confirmDialog()?.nativeElement.showModal();
  }

  protected showDeactivateConfirm(): void {
    this.pendingAction.set('deactivate');
    this.confirmDialog()?.nativeElement.showModal();
  }

  protected closeDialog(): void {
    this.confirmDialog()?.nativeElement.close();
    this.pendingAction.set(undefined);
  }

  protected async confirmAction(): Promise<void> {
    const action = this.pendingAction();
    this.closeDialog();

    if (action === 'activate') {
      await this.activateMembership();
    } else if (action === 'deactivate') {
      await this.deactivateMembership();
    }
  }

  private async activateMembership(): Promise<void> {
    this.actionInProgress.set(true);
    this.error.set(undefined);
    this.successMessage.set(undefined);

    try {
      await this.adminMembersService.activateMembership(this.uid());
      this.successMessage.set('Membership activated successfully');
      await this.loadMember(); // Reload to get updated data
    } catch (error) {
      console.error('Error activating membership:', error);
      this.error.set('Failed to activate membership.');
    } finally {
      this.actionInProgress.set(false);
    }
  }

  private async deactivateMembership(): Promise<void> {
    this.actionInProgress.set(true);
    this.error.set(undefined);
    this.successMessage.set(undefined);

    try {
      await this.adminMembersService.deactivateMembership(this.uid());
      this.successMessage.set('Membership deactivated successfully');
      await this.loadMember(); // Reload to get updated data
    } catch (error) {
      console.error('Error deactivating membership:', error);
      this.error.set('Failed to deactivate membership.');
    } finally {
      this.actionInProgress.set(false);
    }
  }

  protected getConfirmMessage(): string {
    const action = this.pendingAction();
    return action === 'activate'
      ? 'Are you sure you want to activate this membership?'
      : 'Are you sure you want to deactivate this membership?';
  }

  protected async loadProfile(): Promise<void> {
    const member = this.member();
    if (!member?.hasProfile || !member.slug) {
      return;
    }

    this.loadingProfile.set(true);
    this.profileError.set(undefined);

    try {
      const profile = await this.adminMembersService.readMemberProfile(this.uid());
      this.profileContent.set(profile);
    } catch (error) {
      console.error('Error loading profile:', error);
      this.profileError.set('Failed to load profile content. Please try again.');
    } finally {
      this.loadingProfile.set(false);
    }
  }
}
