import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ProfileService } from '../services/profile.service';

@Component({
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfile {
  protected profileService = inject(ProfileService);

  getTagUrl(tag: string): string {
    return this.profileService.getTagUrl(tag);
  }
}
