import { ChangeDetectionStrategy, Component, inject, OnInit, signal } from '@angular/core';
import { ProfileData, ProfileService } from '../services/profile.service';

@Component({
  imports: [],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfile implements OnInit {
  private profileService = inject(ProfileService);

  // eslint-disable-next-line unicorn/no-useless-undefined
  profileData = signal<ProfileData | undefined>(undefined);
  isLoading = signal<boolean>(true);
  error = signal<string>('');

  ngOnInit(): void {
    void this.loadProfile();
  }

  getTagUrl(tag: string): string {
    return this.profileService.getTagUrl(tag);
  }

  private async loadProfile(): Promise<void> {
    try {
      this.isLoading.set(true);
      this.error.set('');
      const profileData = await this.profileService.getProfile();
      this.profileData.set(profileData);
    } catch (error: unknown) {
      console.error('Error reading profile:', error);
      let errorMessage = 'Failed to load profile';
      if (error instanceof Error) {
        errorMessage = error.message;
      }
      this.error.set(errorMessage);
    } finally {
      this.isLoading.set(false);
    }
  }
}
