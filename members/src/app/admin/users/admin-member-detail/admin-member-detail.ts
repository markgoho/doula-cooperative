import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  ElementRef,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import { AdminMemberDetailService } from './admin-member-detail.service';

type ConfirmAction = 'activate' | 'deactivate' | 'delete';

@Component({
  imports: [DatePipe],
  templateUrl: './admin-member-detail.html',
  styleUrl: './admin-member-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminMemberDetailService], // Provide service at component level
})
export class AdminMemberDetail {
  private service = inject(AdminMemberDetailService);
  private router = inject(Router);

  // Route parameter binding (enabled via withComponentInputBinding)
  uid = input.required<string>();

  // Expose service signals for template
  protected member = this.service.member;
  protected loading = this.service.loading;
  protected error = this.service.error;
  protected actionInProgress = this.service.actionInProgress;
  protected successMessage = this.service.successMessage;
  protected actionError = this.service.actionError;
  protected profileContent = this.service.profileContent;
  protected loadingProfile = this.service.loadingProfile;
  protected profileError = this.service.profileError;

  // Component-specific UI state
  protected confirmDialog = viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');
  protected pendingAction = signal<ConfirmAction | undefined>(undefined);

  protected isTargetUserAdmin = computed(() => this.member()?.isAdmin === true);

  constructor() {
    // Initialize service with uid signal
    this.service.init(this.uid);
  }

  protected showActivateConfirm(): void {
    this.pendingAction.set('activate');
    this.confirmDialog()?.nativeElement.showModal();
  }

  protected showDeactivateConfirm(): void {
    this.pendingAction.set('deactivate');
    this.confirmDialog()?.nativeElement.showModal();
  }

  protected showDeleteConfirm(): void {
    this.pendingAction.set('delete');
    this.confirmDialog()?.nativeElement.showModal();
  }

  protected closeDialog(): void {
    this.confirmDialog()?.nativeElement.close();
    this.pendingAction.set(undefined);
  }

  protected async confirmAction(): Promise<void> {
    const action = this.pendingAction();
    this.closeDialog();

    switch (action) {
      case 'activate': {
        await this.service.activateMembership(this.uid());
        break;
      }
      case 'deactivate': {
        await this.service.deactivateMembership(this.uid());
        break;
      }
      case 'delete': {
        await this.deleteUser();
        break;
      }
    }
  }

  protected getConfirmMessage(): string {
    const action = this.pendingAction();
    switch (action) {
      case 'activate': {
        return 'Are you sure you want to activate this membership?';
      }
      case 'deactivate': {
        return 'Are you sure you want to deactivate this membership?';
      }
      case 'delete': {
        return 'Are you sure you want to permanently delete this user account? This action cannot be undone.';
      }
      default: {
        return '';
      }
    }
  }

  protected async loadProfile(): Promise<void> {
    const member = this.member();
    if (member) {
      await this.service.loadProfile(member);
    }
  }

  private async deleteUser(): Promise<void> {
    await this.service.deleteUser(this.uid());

    // Navigate back to user list after successful deletion
    if (this.successMessage()) {
      await this.router.navigate(['/admin/users']);
    }
  }
}
