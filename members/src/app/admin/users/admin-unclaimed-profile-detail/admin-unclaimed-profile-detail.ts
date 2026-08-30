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
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { AdminUnclaimedProfileDetailService } from './admin-unclaimed-profile-detail.service';

@Component({
  imports: [DatePipe, FormsModule, ConfirmDialog, AlertBanner],
  templateUrl: './admin-unclaimed-profile-detail.html',
  styleUrl: './admin-unclaimed-profile-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminUnclaimedProfileDetailService],
})
export class AdminUnclaimedProfileDetail {
  protected service = inject(AdminUnclaimedProfileDetailService);
  private router = inject(Router);

  email = input.required<string>();

  protected deleteConfirmDialog = viewChild<ConfirmDialog>('deleteConfirmDialog');
  protected draftConfirmDialog = viewChild<ConfirmDialog>('draftConfirmDialog');

  protected deleteConfirmMessage = computed(() => {
    const resource = this.service.unclaimedProfileResource;
    if (resource.hasValue() && resource.value().slug) {
      return 'This will remove the unclaimed profile, unsubscribe from the newsletter, and permanently delete the public doula profile.';
    }
    return 'This will remove the unclaimed profile and unsubscribe from the newsletter.';
  });

  protected showUpdateEmailForm = signal(false);
  protected updateEmailValue = signal('');

  constructor() {
    this.service.init(this.email);
  }

  protected showDeleteConfirm(): void {
    this.deleteConfirmDialog()?.showModal();
  }

  protected showDraftConfirm(): void {
    this.draftConfirmDialog()?.showModal();
  }

  protected async onConfirmDelete(): Promise<void> {
    try {
      await this.service.deleteProfile(this.email());
      this.deleteConfirmDialog()?.close();
      await this.router.navigateByUrl('/admin/unclaimed');
    } catch {
      // Error already handled in service (sets actionError signal)
      this.deleteConfirmDialog()?.close();
    }
  }

  protected async onConfirmDraft(): Promise<void> {
    try {
      await this.service.draftProfile(this.email());
    } catch {
      // Error already handled in service (sets actionError signal)
    } finally {
      this.draftConfirmDialog()?.close();
    }
  }

  protected onCancelDelete(): void {
    this.deleteConfirmDialog()?.close();
  }

  protected onCancelDraft(): void {
    this.draftConfirmDialog()?.close();
  }

  protected async updateEmail(): Promise<void> {
    const newEmail = await this.service.updateEmail(this.email(), this.updateEmailValue());
    if (newEmail !== undefined) {
      await this.router.navigate(['/admin/unclaimed', newEmail]);
    }
  }
}
