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
import type { Member } from '../../admin.types';
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
  protected service = inject(AdminMemberDetailService);
  private router = inject(Router);

  // Route parameter binding (enabled via withComponentInputBinding)
  uid = input.required<string>();

  // Component-specific UI state
  protected confirmDialog = viewChild<ElementRef<HTMLDialogElement>>('confirmDialog');
  protected pendingAction = signal<ConfirmAction | undefined>(undefined);

  protected isTargetUserAdmin = computed(() => {
    const resource = this.service.memberResource;
    if (!resource.hasValue()) return false;
    return (resource.value() as Member).isAdmin === true;
  });

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
