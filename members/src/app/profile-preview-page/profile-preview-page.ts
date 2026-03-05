import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MembershipService } from '../services/membership.service';
import { ProfileService } from '../services/profile.service';
import { AlertBanner } from '../shared/alert-banner/alert-banner';
import { ProfilePreview } from '../shared/profile-preview/profile-preview';

@Component({
  imports: [ProfilePreview, AlertBanner, RouterLink],
  templateUrl: './profile-preview-page.html',
  styleUrl: './profile-preview-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfilePreviewPage {
  protected readonly profileService = inject(ProfileService);
  protected readonly membershipService = inject(MembershipService);

  protected readonly profile = this.profileService.profile;
  protected readonly profileImageUrl = this.profileService.profileImageUrl;
  protected readonly profileResource = this.profileService.profileResource;

  constructor() {
    this.profileService.loadProfile();
  }

  protected retryLoadProfile(): void {
    this.profileService.profileResource.reload();
  }
}
