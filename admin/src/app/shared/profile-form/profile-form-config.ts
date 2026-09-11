import { FormArray, FormBuilder, FormControl, FormGroup, Validators } from '@angular/forms';

/**
 * TypeScript interface for profile form controls structure
 */
export interface ProfileFormControls {
  title: FormControl<string | null>;
  pronouns: FormControl<string | null>;
  credentials: FormControl<string | null>;
  tags: FormArray<FormControl<boolean | null>>;
  bio: FormControl<string | null>;
  businessName: FormControl<string | null>;
  phone: FormControl<string | null>;
  email: FormControl<string | null>;
  website: FormControl<string | null>;
}

/**
 * Factory function to create a profile form group with validation
 * @param fb - FormBuilder instance
 * @returns Configured FormGroup for profile data
 */
export function createProfileFormGroup(fb: FormBuilder): FormGroup<ProfileFormControls> {
  return fb.group({
    title: ['', Validators.required],
    pronouns: [''],
    credentials: [''],
    tags: fb.array<FormControl<boolean | null>>([], Validators.required),
    bio: ['', Validators.required],
    businessName: [''],
    phone: [''],
    email: ['', Validators.email],
    website: [''],
  });
}

/**
 * Re-export profile tags constant for consistency
 */

export { PROFILE_TAGS } from '../../constants/profile-tags';
