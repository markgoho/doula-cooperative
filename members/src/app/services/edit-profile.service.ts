import { Injectable, computed, inject } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { type ProfileData } from '../types/profile-data';
import { ProfileService } from './profile.service';

@Injectable({
  providedIn: 'root',
})
export class EditProfileService {
  private functions = inject(Functions);
  private profileService = inject(ProfileService);

  // Expose profile from ProfileService for easy access in edit components
  readonly profile = computed(() => this.profileService.profileResource.value());

  async updateProfile(data: ProfileData): Promise<void> {
    const writeProfileCallable = httpsCallable<ProfileData, { success: boolean }>(
      this.functions,
      'writeProfile',
    );

    try {
      await writeProfileCallable(data);

      // Reload the profile resource to reflect the updated data
      this.profileService.profileResource.reload();
    } catch (error) {
      console.error('Error calling writeProfile function:', error);
      throw error;
    }
  }

  getTagUrl(tag: string): string {
    return this.profileService.getTagUrl(tag);
  }
}
