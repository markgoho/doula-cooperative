import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { type Member } from '../../services/membership.service';
import { type ProfileData } from '../../types/profile-data';
import { PROFILE_TAGS } from './profile-form-config';

/**
 * Initialize form for editing an existing profile
 * Populates form with data from existing profile
 * @param form - The form group to initialize
 * @param profile - The existing profile data
 */
export function initializeEditProfileForm(form: FormGroup, profile: ProfileData): void {
  form.patchValue({
    title: profile.title,
    pronouns: profile.pronouns || '',
    credentials: profile.credentials || '',
    bio: profile.bio,
    businessName: profile.contact?.business_name || '',
    phone: profile.contact?.phone || '',
    email: profile.contact?.email || '',
    website: profile.contact?.website || '',
  });

  // Initialize tags checkboxes
  const tagsArray = form.get('tags') as FormArray;
  tagsArray.clear();
  for (const tag of PROFILE_TAGS) {
    const isSelected = profile.tags?.includes(tag) || false;
    tagsArray.push(new FormControl(isSelected));
  }
}

/**
 * Initialize form for creating a new profile
 * Pre-fills basic info from member document
 * @param form - The form group to initialize
 * @param member - The member document data
 */
export function initializeCreateProfileForm(form: FormGroup, member: Member): void {
  form.patchValue({
    title: member.name || '',
    pronouns: '',
    credentials: '',
    bio: '',
    businessName: '',
    phone: '',
    email: member.email || '',
    website: '',
  });

  // Initialize all tags as unchecked
  const tagsArray = form.get('tags') as FormArray;
  tagsArray.clear();
  const tagControls = Array.from({ length: PROFILE_TAGS.length }, () => new FormControl(false));
  for (const control of tagControls) {
    tagsArray.push(control);
  }
}

/**
 * Extract ProfileData from form values
 * Transforms form data into the ProfileData shape expected by the service
 * @param form - The form group to extract data from
 * @returns ProfileData object ready for submission
 */
export function extractProfileData(form: FormGroup): ProfileData {
  const formValue = form.value;
  const tagsArray = form.get('tags') as FormArray;

  // Filter selected tags
  const selectedTags = PROFILE_TAGS.filter((_, index) => tagsArray.at(index)?.value);

  // Build ProfileData with required fields
  const profileData: ProfileData = {
    title: formValue.title!,
    bio: formValue.bio!,
  };

  // Add optional fields only if they have values
  if (formValue.pronouns) {
    profileData.pronouns = formValue.pronouns;
  }

  if (formValue.credentials) {
    profileData.credentials = formValue.credentials;
  }

  if (selectedTags.length > 0) {
    profileData.tags = selectedTags;
  }

  // Build contact object only if at least one contact field has a value
  const hasContactInfo =
    formValue.businessName || formValue.phone || formValue.email || formValue.website;

  if (hasContactInfo) {
    profileData.contact = {};

    if (formValue.businessName) {
      profileData.contact.business_name = formValue.businessName;
    }
    if (formValue.phone) {
      profileData.contact.phone = formValue.phone;
    }
    if (formValue.email) {
      profileData.contact.email = formValue.email;
    }
    if (formValue.website) {
      profileData.contact.website = formValue.website;
    }
  }

  return profileData;
}

/**
 * Mark all form controls as touched to trigger validation display
 * @param form - The form group to mark
 */
export function markAllTouched(form: FormGroup): void {
  for (const key of Object.keys(form.controls)) {
    form.get(key)?.markAsTouched();
  }
}
