import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { MembershipService } from '../services/membership.service';
import { ProfileService } from '../services/profile.service';
import { AlertBanner } from '../shared/alert-banner/alert-banner';
import { createProfileFormGroup, PROFILE_TAGS } from '../shared/profile-form/profile-form-config';
import {
  extractProfileData,
  initializeCreateProfileForm,
  markAllTouched,
} from '../shared/profile-form/profile-form-utilities';

@Component({
  imports: [ReactiveFormsModule, AlertBanner],
  templateUrl: './create-profile.html',
  styleUrls: ['../shared/profile-form/profile-form-styles.scss', './create-profile.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CreateProfile {
  private profileService = inject(ProfileService);
  private membershipService = inject(MembershipService);
  private fb = inject(FormBuilder);
  private router = inject(Router);

  protected userDocument = this.membershipService.userDocument;
  protected availableTags = PROFILE_TAGS;

  protected profileForm = createProfileFormGroup(this.fb);
  protected loading = signal(false);
  protected errorMessage = signal('');
  protected successMessage = signal('');

  constructor() {
    // Initialize form when user document loads
    effect(() => {
      const user = this.userDocument();
      if (user && !this.profileForm.dirty) {
        initializeCreateProfileForm(this.profileForm, user);
      }
    });
  }

  protected async onSubmit() {
    if (this.profileForm.invalid) {
      markAllTouched(this.profileForm);
      this.errorMessage.set('Please fill in all required fields correctly.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const profileData = extractProfileData(this.profileForm);
      await this.profileService.createProfileContent(profileData);
      this.successMessage.set('Profile created successfully!');

      // Navigate to edit mode after successful creation
      setTimeout(() => {
        void this.router.navigate(['/profile']);
      }, 1500);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to create profile. Please try again.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  protected onCancel() {
    void this.router.navigate(['/membership']);
  }

  // Control accessors for template
  protected get titleControl() {
    return this.profileForm.get('title');
  }

  protected get pronounsControl() {
    return this.profileForm.get('pronouns');
  }

  protected get credentialsControl() {
    return this.profileForm.get('credentials');
  }

  protected get tagsArray() {
    return this.profileForm.get('tags') as FormArray;
  }

  protected get bioControl() {
    return this.profileForm.get('bio');
  }

  protected get businessNameControl() {
    return this.profileForm.get('businessName');
  }

  protected get phoneControl() {
    return this.profileForm.get('phone');
  }

  protected get emailControl() {
    return this.profileForm.get('email');
  }

  protected get websiteControl() {
    return this.profileForm.get('website');
  }

  protected getTagControl(index: number): FormControl {
    return this.tagsArray.at(index) as FormControl;
  }
}
