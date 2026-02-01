import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { Router } from '@angular/router';
import type { Member } from '../../admin.types';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { AdminMemberDetailService } from './admin-member-detail.service';

type ConfirmAction = 'activate' | 'deactivate' | 'delete';

interface DialogConfig {
  title: string;
  message: string;
  confirmText: string;
  variant: 'primary' | 'danger';
}

@Component({
  imports: [DatePipe, ConfirmDialog],
  templateUrl: './admin-member-detail.html',
  styleUrl: './admin-member-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminMemberDetailService], // Provide service at component level
})
export class AdminMemberDetail {
  protected service = inject(AdminMemberDetailService);
  private router = inject(Router);

  // Route parameter binding (enabled via withComponentInputBinding)
  uid = input.required<string>();

  // Component-specific UI state
  protected confirmDialog = viewChild(ConfirmDialog);
  protected pendingAction = signal<ConfirmAction | undefined>(undefined);
  protected dialogConfig = signal<DialogConfig>({
    title: '',
    message: '',
    confirmText: 'Confirm',
    variant: 'primary',
  });

  protected isTargetUserAdmin = computed(() => {
    const resource = this.service.memberResource;
    if (!resource.hasValue()) return false;
    return (resource.value() as Member).isAdmin;
  });

  constructor() {
    // Initialize service with uid signal
    this.service.init(this.uid);
  }

  protected showActivateConfirm(): void {
    this.pendingAction.set('activate');
    this.dialogConfig.set({
      title: 'Confirm Activation',
      message: 'Are you sure you want to activate this membership?',
      confirmText: 'Activate',
      variant: 'primary',
    });
    this.confirmDialog()?.showModal();
  }

  protected showDeactivateConfirm(): void {
    this.pendingAction.set('deactivate');
    this.dialogConfig.set({
      title: 'Confirm Deactivation',
      message: 'Are you sure you want to deactivate this membership?',
      confirmText: 'Deactivate',
      variant: 'danger',
    });
    this.confirmDialog()?.showModal();
  }

  protected showDeleteConfirm(): void {
    this.pendingAction.set('delete');
    this.dialogConfig.set({
      title: 'Confirm Deletion',
      message:
        'Are you sure you want to permanently delete this user account? This action cannot be undone.',
      confirmText: 'Delete',
      variant: 'danger',
    });
    this.confirmDialog()?.showModal();
  }

  protected onCancelDialog(): void {
    this.confirmDialog()?.close();
    this.pendingAction.set(undefined);
  }

  protected async onConfirmDialog(): Promise<void> {
    const action = this.pendingAction();

    try {
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
    } finally {
      this.confirmDialog()?.close();
      this.pendingAction.set(undefined);
    }
  }

  protected loadProfile(): void {
    if (this.service.memberResource.hasValue()) {
      this.service.loadProfile(this.service.memberResource.value() as Member);
    }
  }

  private async deleteUser(): Promise<void> {
    await this.service.deleteUser(this.uid());

    // Navigate back to members list after successful deletion
    if (this.service.successMessage()) {
      await this.router.navigate(['/admin/members']);
    }
  }
}
