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
  protected service = inject(AdminUnclaimedProfileDetailService);

  // Route parameter binding (enabled via withComponentInputBinding)
  email = input.required<string>();

  protected invitationAlreadySent = computed(() => {
    const resource = this.service.unclaimedProfileResource;
    if (!resource.hasValue()) return false;
    return resource.value().invitationEmailStatus === 'sent';
  });

  constructor() {
    // Initialize service with email signal
    this.service.init(this.email);
  }

  protected async sendInvitation(): Promise<void> {
    await this.service.sendInvitation(this.email());
  }
}
