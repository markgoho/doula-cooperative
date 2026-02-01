import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { Router } from '@angular/router';
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
  private router = inject(Router);

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

  protected async deleteProfile(): Promise<void> {
    if (
      !confirm(
        'Are you sure you want to delete this unclaimed profile? This action cannot be undone.',
      )
    ) {
      return;
    }

    try {
      await this.service.deleteProfile(this.email());
      await this.router.navigateByUrl('/admin/unclaimed');
    } catch {
      // Error already handled in service (sets actionError signal)
    }
  }
}
