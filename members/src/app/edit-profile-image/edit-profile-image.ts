import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { EditProfileService } from '../services/edit-profile.service';

@Component({
  imports: [RouterLink],
  templateUrl: './edit-profile-image.html',
  styleUrl: './edit-profile-image.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfileImage {
  private editProfileService = inject(EditProfileService);

  readonly profileData = this.editProfileService.profile;
}
