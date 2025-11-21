import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { AdminUnclaimedProfileDetailService } from './admin-unclaimed-profile-detail.service';

@Component({
  imports: [DatePipe],
  templateUrl: './admin-unclaimed-profile-detail.html',
  styleUrl: './admin-unclaimed-profile-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminUnclaimedProfileDetailService], // Provide service at component level
})
export class AdminUnclaimedProfileDetail {
  private service = inject(AdminUnclaimedProfileDetailService);

  // Route parameter binding (enabled via withComponentInputBinding)
  email = input.required<string>();

  // Expose service signals for template
  protected unclaimedProfile = this.service.unclaimedProfile;
  protected loading = this.service.loading;
  protected error = this.service.error;
  protected actionInProgress = this.service.actionInProgress;
  protected successMessage = this.service.successMessage;
  protected actionError = this.service.actionError;

  protected invitationAlreadySent = computed(() => {
    const unclaimed = this.unclaimedProfile();
    return unclaimed?.invitationEmailStatus === 'sent';
  });

  constructor() {
    // Initialize service with email signal
    this.service.init(this.email);
  }

  protected async sendInvitation(): Promise<void> {
    await this.service.sendInvitation(this.email());
  }
}
