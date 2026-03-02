import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { MembershipService } from '../services/membership.service';
import { ProfileService } from '../services/profile.service';
import { AlertBanner } from '../shared/alert-banner/alert-banner';
import { createProfileFormGroup, PROFILE_TAGS } from '../shared/profile-form/profile-form-config';
import {
  extractProfileData,
  initializeEditProfileForm,
  markAllTouched,
} from '../shared/profile-form/profile-form-utilities';

const MAX_AUTO_RETRIES = 3;
const RETRY_DELAY_MS = 2000;
const SLOW_RETRY_DELAY_MS = 15_000;
const MAX_SLOW_RETRIES = 10;

@Component({
  imports: [ReactiveFormsModule, AlertBanner],
  templateUrl: './edit-profile.html',
  styleUrls: ['../shared/profile-form/profile-form-styles.scss', './edit-profile.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfile {
  readonly profileService = inject(ProfileService);
  readonly membershipService = inject(MembershipService);
  private fb = inject(FormBuilder);
  private destroyReference = inject(DestroyRef);

  protected profile = this.profileService.profile;
  protected availableTags = PROFILE_TAGS;

  protected profileForm = createProfileFormGroup(this.fb);
  protected loading = signal(false);
  protected errorMessage = signal('');
  protected successMessage = signal('');
  protected infoMessage = signal('');
  protected syncPending = signal(false);

  protected isMembershipInactive = computed(() => {
    const user = this.membershipService.userDocument();
    return user !== undefined && !user.membershipActive;
  });
  private autoRetryCount = 0;
  private slowRetryCount = 0;
  private slowRetryTimer: ReturnType<typeof setTimeout> | undefined;

  constructor() {
    this.destroyReference.onDestroy(() => {
      if (this.slowRetryTimer !== undefined) {
        clearTimeout(this.slowRetryTimer);
      }
    });

    effect(() => {
      const profile = this.profile();
      if (profile && !this.profileForm.dirty) {
        initializeEditProfileForm(this.profileForm, profile);
      }
    });

    // Reset sync state when resource successfully resolves
    effect(() => {
      const status = this.profileService.profileResource.status();
      if (status === 'resolved') {
        this.syncPending.set(false);
        this.autoRetryCount = 0;
        this.slowRetryCount = 0;
        if (this.slowRetryTimer !== undefined) {
          clearTimeout(this.slowRetryTimer);
          this.slowRetryTimer = undefined;
        }
      }
    });

    effect(() => {
      const status = this.profileService.profileResource.status();
      if (status !== 'error') return;

      if (this.autoRetryCount < MAX_AUTO_RETRIES) {
        this.autoRetryCount++;
        setTimeout(() => {
          this.profileService.profileResource.reload();
        }, RETRY_DELAY_MS);
      } else if (this.profile() !== undefined) {
        // Optimistic data exists — the user just created/updated their profile.
        // Show sync-pending banner and continue slow background retries.
        this.syncPending.set(true);
        this.scheduleSlowRetry();
      }
      // If no optimistic data, fall through to the error UI (genuine failure).
    });
  }

  private scheduleSlowRetry(): void {
    if (this.slowRetryCount >= MAX_SLOW_RETRIES) return;

    this.slowRetryTimer = setTimeout(() => {
      this.slowRetryCount++;
      this.profileService.profileResource.reload();
    }, SLOW_RETRY_DELAY_MS);
  }

  protected retryLoadProfile(): void {
    this.profileService.profileResource.reload();
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
    this.infoMessage.set('');

    try {
      const profileData = extractProfileData(this.profileForm);
      await this.profileService.updateProfile(profileData);
      this.successMessage.set('Profile updated successfully!');
      this.profileForm.markAsPristine();
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to update profile. Please try again.';
      this.errorMessage.set(message);
    } finally {
      this.loading.set(false);
    }
  }

  protected onCancel(): void {
    if (!this.profileForm.dirty) {
      this.infoMessage.set('No changes to discard.');
      return;
    }
    const profile = this.profile();
    if (profile) {
      initializeEditProfileForm(this.profileForm, profile);
    }
    this.errorMessage.set('');
    this.successMessage.set('');
    this.infoMessage.set('');
  }

  protected getTagUrl(tag: string): string {
    return this.profileService.getTagUrl(tag);
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
