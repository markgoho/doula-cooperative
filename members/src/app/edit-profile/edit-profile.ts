import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProfileService } from '../services/profile.service';

@Component({
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfile {
  private profileService = inject(ProfileService);

  // Use the profile service's cached profile signal directly
  readonly profileData = this.profileService.profile;

  getTagUrl(tag: string): string {
    return this.profileService.getTagUrl(tag);
  }
}
