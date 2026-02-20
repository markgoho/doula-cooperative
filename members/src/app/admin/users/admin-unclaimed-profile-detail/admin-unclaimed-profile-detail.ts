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
import { AdminUnclaimedProfileDetailService } from './admin-unclaimed-profile-detail.service';

@Component({
  imports: [DatePipe, FormsModule, ConfirmDialog],
  templateUrl: './admin-unclaimed-profile-detail.html',
  styleUrl: './admin-unclaimed-profile-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminUnclaimedProfileDetailService],
})
export class AdminUnclaimedProfileDetail {
  protected service = inject(AdminUnclaimedProfileDetailService);
  private router = inject(Router);

  email = input.required<string>();

  protected confirmDialog = viewChild(ConfirmDialog);

  protected invitationAlreadySent = computed(() => {
    const resource = this.service.unclaimedProfileResource;
    if (!resource.hasValue()) return false;
    return resource.value().invitationEmailStatus === 'sent';
  });

  protected deleteConfirmMessage = computed(() => {
    const resource = this.service.unclaimedProfileResource;
    if (resource.hasValue() && resource.value().slug) {
      return 'This will remove the unclaimed profile, unsubscribe from the newsletter, and set the public doula profile to draft.';
    }
    return 'This will remove the unclaimed profile and unsubscribe from the newsletter.';
  });

  protected showChangeEmailForm = signal(false);
  protected newEmailValue = signal('');

  protected showUpdateEmailForm = signal(false);
  protected updateEmailValue = signal('');

  constructor() {
    this.service.init(this.email);
  }

  protected async sendInvitation(): Promise<void> {
    await this.service.sendInvitation(this.email());
  }

  protected showDeleteConfirm(): void {
    this.confirmDialog()?.showModal();
  }

  protected async onConfirmDelete(): Promise<void> {
    try {
      await this.service.deleteProfile(this.email());
      this.confirmDialog()?.close();
      await this.router.navigateByUrl('/admin/unclaimed');
    } catch {
      // Error already handled in service (sets actionError signal)
      this.confirmDialog()?.close();
    }
  }

  protected onCancelDelete(): void {
    this.confirmDialog()?.close();
  }

  protected async changeEmailAndResend(): Promise<void> {
    const newEmail = await this.service.changeEmailAndResend(this.email(), this.newEmailValue());
    if (newEmail !== undefined) {
      await this.router.navigate(['/admin/unclaimed', newEmail]);
    }
  }

  protected async updateEmail(): Promise<void> {
    const newEmail = await this.service.updateEmail(this.email(), this.updateEmailValue());
    if (newEmail !== undefined) {
      await this.router.navigate(['/admin/unclaimed', newEmail]);
    }
  }
}
