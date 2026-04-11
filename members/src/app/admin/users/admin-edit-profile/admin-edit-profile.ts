import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import {
  createProfileFormGroup,
  PROFILE_TAGS,
} from '../../../shared/profile-form/profile-form-config';
import {
  extractProfileData,
  initializeEditProfileForm,
  markAllTouched,
} from '../../../shared/profile-form/profile-form-utilities';
import { AdminMemberDetailService } from '../admin-member-detail/admin-member-detail.service';

@Component({
  imports: [ReactiveFormsModule, AlertBanner, RouterLink],
  templateUrl: './admin-edit-profile.html',
  styleUrls: ['../../../shared/profile-form/profile-form-styles.scss', './admin-edit-profile.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
  providers: [AdminMemberDetailService],
})
export class AdminEditProfile {
  protected service = inject(AdminMemberDetailService);
  private formBuilder = inject(FormBuilder);
  private router = inject(Router);

  readonly uid = input.required<string>();

  protected availableTags = PROFILE_TAGS;
  protected profileForm = createProfileFormGroup(this.formBuilder);
  protected loading = signal(false);
  protected errorMessage = signal('');
  protected successMessage = signal('');
  protected infoMessage = signal('');

  constructor() {
    this.service.init(this.uid);

    effect(() => {
      const member = this.service.memberResource.value();
      if (member?.slug) {
        this.service.loadProfile(member);
      }
    });

    effect(() => {
      const profile = this.service.profileResource.value();
      if (profile && !this.profileForm.dirty) {
        initializeEditProfileForm(this.profileForm, profile);
      }
    });
  }

  protected async onSubmit(): Promise<void> {
    if (this.profileForm.invalid) {
      markAllTouched(this.profileForm);
      this.errorMessage.set('Please fill in all required fields correctly.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');
    this.infoMessage.set('');

    try {
      const profileData = extractProfileData(this.profileForm);
      await this.service.updateProfile(this.uid(), profileData);
      this.successMessage.set('Profile updated successfully.');
      this.profileForm.markAsPristine();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update profile. Please try again.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  protected async onCancel(): Promise<void> {
    if (this.profileForm.dirty) {
      const profile = this.service.profileResource.value();
      if (profile) {
        initializeEditProfileForm(this.profileForm, profile);
      }
    }

    this.errorMessage.set('');
    this.successMessage.set('');
    this.infoMessage.set('');
    await this.router.navigate(['/admin/members', this.uid(), 'profile']);
  }

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
