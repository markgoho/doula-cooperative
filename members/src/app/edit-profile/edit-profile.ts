import { ChangeDetectionStrategy, Component, effect, inject, OnDestroy, signal } from '@angular/core';
import { FormArray, FormBuilder, FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { PROFILE_TAGS } from '../constants/profile-tags';
import { ProfileService } from '../services/profile.service';

@Component({
  imports: [ReactiveFormsModule],
  templateUrl: './edit-profile.html',
  styleUrl: './edit-profile.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class EditProfile implements OnDestroy {
  private profileService = inject(ProfileService);
  private fb = inject(FormBuilder);
  private router = inject(Router);
  private destroy$ = new Subject<void>();

  // Use the profile service's cached profile signal directly
  readonly profileData = this.profileService.profile;

  // Available tags for selection
  readonly availableTags = PROFILE_TAGS;

  // Form state
  profileForm = this.fb.group({
    title: ['', Validators.required],
    credentials: [''],
    tags: this.fb.array([], Validators.required),
    bio: ['', Validators.required],
    businessName: [''],
    phone: [''],
    email: ['', Validators.email],
    website: [''],
  });

  loading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  constructor() {
    // Initialize form when profile data loads
    effect(() => {
      const profile = this.profileData();
      if (profile && !this.profileForm.dirty) {
        this.initializeForm(profile);
      }
    }, { allowSignalWrites: true });
  }

  ngOnDestroy() {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private initializeForm(profile: ReturnType<typeof this.profileData>) {
    if (!profile) return;

    this.profileForm.patchValue({
      title: profile.title,
      credentials: profile.credentials || '',
      bio: profile.bio,
      businessName: profile.contact?.business_name || '',
      phone: profile.contact?.phone || '',
      email: profile.contact?.email || '',
      website: profile.contact?.website || '',
    });

    // Initialize tags checkboxes
    const tagsArray = this.profileForm.get('tags') as FormArray;
    tagsArray.clear();

    for (const tag of this.availableTags) {
      const isSelected = profile.tags?.includes(tag) || false;
      tagsArray.push(new FormControl(isSelected));
    }
  }

  async onSubmit() {
    if (this.profileForm.invalid) {
      this.markFormGroupTouched();
      this.errorMessage.set('Please fill in all required fields correctly.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      const formValue = this.profileForm.value;
      const tagsArray = this.profileForm.get('tags') as FormArray;

      // Get selected tags
      const selectedTags = this.availableTags.filter((_, index) => tagsArray.at(index).value);

      // Build profile data object
      const profileData = {
        title: formValue.title!,
        credentials: formValue.credentials || undefined,
        tags: selectedTags.length > 0 ? selectedTags : undefined,
        bio: formValue.bio!,
        contact: {
          business_name: formValue.businessName || undefined,
          phone: formValue.phone || undefined,
          email: formValue.email || undefined,
          website: formValue.website || undefined,
        },
      };

      await this.profileService.updateProfile(profileData);

      this.successMessage.set('Profile updated successfully!');

      // Mark form as pristine after successful save
      this.profileForm.markAsPristine();
    } catch (error) {
      if (error instanceof Error) {
        this.errorMessage.set(`Failed to update profile: ${error.message}`);
      } else {
        this.errorMessage.set('Failed to update profile. Please try again.');
      }
    } finally {
      this.loading.set(false);
    }
  }

  onCancel() {
    // Reset form to original profile data
    const profile = this.profileData();
    if (profile) {
      this.initializeForm(profile);
    }
    this.errorMessage.set('');
    this.successMessage.set('');
  }

  private markFormGroupTouched() {
    for (const key of Object.keys(this.profileForm.controls)) {
      const control = this.profileForm.get(key);
      control?.markAsTouched();
    }
  }

  getTagUrl(tag: string): string {
    return this.profileService.getTagUrl(tag);
  }

  get titleControl() {
    return this.profileForm.get('title');
  }
  get credentialsControl() {
    return this.profileForm.get('credentials');
  }
  get tagsArray() {
    return this.profileForm.get('tags') as FormArray;
  }
  get bioControl() {
    return this.profileForm.get('bio');
  }
  get businessNameControl() {
    return this.profileForm.get('businessName');
  }
  get phoneControl() {
    return this.profileForm.get('phone');
  }
  get emailControl() {
    return this.profileForm.get('email');
  }
  get websiteControl() {
    return this.profileForm.get('website');
  }
}
