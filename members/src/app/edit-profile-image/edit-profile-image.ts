import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ProfileService } from '../services/profile.service';

@Component({
  imports: [RouterLink],
  templateUrl: './edit-profile-image.html',
  styleUrl: './edit-profile-image.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfileImage {
  readonly profileService = inject(ProfileService);
}
