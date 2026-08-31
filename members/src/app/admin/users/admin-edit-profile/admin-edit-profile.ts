import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  input,
  signal,
  viewChild,
} from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AlertBanner } from '../../../shared/alert-banner/alert-banner';
import { ConfirmDialog } from '../../../shared/confirm-dialog/confirm-dialog';
import {
  createProfileFormGroup,
  PROFILE_TAGS,
} from '../../../shared/profile-form/profile-form-config';
import {
  ALLOWED_PROFILE_IMAGE_TYPES,
  MAX_PROFILE_IMAGE_SIZE,
} from '../../../shared/profile-image-limits';
import {
  extractProfileData,
  initializeEditProfileForm,
  markAllTouched,
} from '../../../shared/profile-form/profile-form-utilities';
import { AdminMemberDetailService } from '../admin-member-detail/admin-member-detail.service';

@Component({
  imports: [ReactiveFormsModule, AlertBanner, ConfirmDialog, RouterLink],
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
  protected imageError = signal('');
  protected imageMessage = signal('');
  protected imageBusy = signal(false);

  private confirmDialog = viewChild(ConfirmDialog);
  private slugPendingImageRemoval = signal<string | undefined>(undefined);

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

  protected async onImageSelected(event: Event, slug: string | undefined): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];

    // Reset the input so the same file can be picked again after an error
    input.value = '';
    this.imageError.set('');

    if (!file) {
      return;
    }

    if (!slug) {
      this.imageError.set('This member has no linked profile to attach an image to.');
      return;
    }

    if (!ALLOWED_PROFILE_IMAGE_TYPES.has(file.type)) {
      this.imageError.set('Please select a valid image (JPEG, PNG, or WebP).');
      return;
    }

    if (file.size > MAX_PROFILE_IMAGE_SIZE) {
      this.imageError.set('Image is too large. Maximum size is 10MB.');
      return;
    }

    this.imageBusy.set(true);

    try {
      await this.service.uploadProfileImage(slug, file);
      this.imageMessage.set('Profile image updated.');
    } catch (error) {
      console.error('Error uploading profile image:', error);
      this.imageError.set('Failed to upload profile image. Please try again.');
    } finally {
      this.imageBusy.set(false);
    }
  }

  protected onRemoveImage(slug: string | undefined): void {
    this.imageError.set('');
    this.imageMessage.set('');

    if (!slug) {
      this.imageError.set('This member has no linked profile to remove an image from.');
      return;
    }

    this.slugPendingImageRemoval.set(slug);
    this.confirmDialog()?.showModal();
  }

  protected async onConfirmRemoveImage(): Promise<void> {
    const slug = this.slugPendingImageRemoval();
    this.confirmDialog()?.close();
    this.slugPendingImageRemoval.set(undefined);

    if (!slug) {
      return;
    }

    this.imageBusy.set(true);

    try {
      await this.service.deleteProfileImage(slug);
      this.imageMessage.set('Profile image removed.');
    } catch (error) {
      console.error('Error removing profile image:', error);
      this.imageError.set('Failed to remove profile image. Please try again.');
    } finally {
      this.imageBusy.set(false);
    }
  }

  protected onCancelRemoveImage(): void {
    this.confirmDialog()?.close();
    this.slugPendingImageRemoval.set(undefined);
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
