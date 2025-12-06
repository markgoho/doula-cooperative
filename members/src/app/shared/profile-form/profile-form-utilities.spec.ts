import { FormArray, FormBuilder } from '@angular/forms';
import { describe, expect, it } from 'vitest';
import { Timestamp } from '../../../test-utils/timestamp-mock';
import { type Member } from '../../services/membership.service';
import { type ProfileData } from '../../types/profile-data';
import { createProfileFormGroup, PROFILE_TAGS } from './profile-form-config';
import {
  extractProfileData,
  initializeCreateProfileForm,
  initializeEditProfileForm,
  markAllTouched,
} from './profile-form-utilities';

describe('Profile Form Utilities', () => {
  const fb = new FormBuilder();

  describe('initializeEditProfileForm', () => {
    it('should populate all form fields from profile data', () => {
      const form = createProfileFormGroup(fb);
      const profile: ProfileData = {
        title: 'Jane Doe',
        pronouns: 'she/her',
        credentials: 'CD(DONA), CPD',
        bio: 'Experienced doula serving families.',
        tags: ['Birth Doula', 'Postpartum Doula'],
        contact: {
          business_name: 'Gentle Birth Support',
          phone: '555-123-4567',
          email: 'jane@example.com',
          website: 'example.com',
        },
      };

      initializeEditProfileForm(form, profile);

      expect(form.value.title).toBe('Jane Doe');
      expect(form.value.pronouns).toBe('she/her');
      expect(form.value.credentials).toBe('CD(DONA), CPD');
      expect(form.value.bio).toBe('Experienced doula serving families.');
      expect(form.value.businessName).toBe('Gentle Birth Support');
      expect(form.value.phone).toBe('555-123-4567');
      expect(form.value.email).toBe('jane@example.com');
      expect(form.value.website).toBe('example.com');
    });

    it('should handle optional fields being undefined', () => {
      const form = createProfileFormGroup(fb);
      const profile: ProfileData = {
        title: 'Jane Doe',
        bio: 'Experienced doula.',
      };

      initializeEditProfileForm(form, profile);

      expect(form.value.title).toBe('Jane Doe');
      expect(form.value.pronouns).toBe('');
      expect(form.value.credentials).toBe('');
      expect(form.value.businessName).toBe('');
    });

    it('should correctly set tag checkboxes based on profile tags', () => {
      const form = createProfileFormGroup(fb);
      const profile: ProfileData = {
        title: 'Jane Doe',
        bio: 'Experienced doula.',
        tags: ['Birth Doula', 'Lactation Support'],
      };

      initializeEditProfileForm(form, profile);

      const tagsArray = form.get('tags') as FormArray;
      expect(tagsArray.length).toBe(PROFILE_TAGS.length);

      const birthDoulaIndex = PROFILE_TAGS.indexOf('Birth Doula');
      const lactationIndex = PROFILE_TAGS.indexOf('Lactation Support');
      const postpartumIndex = PROFILE_TAGS.indexOf('Postpartum Doula');

      expect(tagsArray.at(birthDoulaIndex).value).toBe(true);
      expect(tagsArray.at(lactationIndex).value).toBe(true);
      expect(tagsArray.at(postpartumIndex).value).toBe(false);
    });

    it('should handle profile with no tags', () => {
      const form = createProfileFormGroup(fb);
      const profile: ProfileData = {
        title: 'Jane Doe',
        bio: 'Experienced doula.',
      };

      initializeEditProfileForm(form, profile);

      const tagsArray = form.get('tags') as FormArray;
      expect(tagsArray.length).toBe(PROFILE_TAGS.length);

      // All should be false
      for (let index = 0; index < tagsArray.length; index++) {
        expect(tagsArray.at(index).value).toBe(false);
      }
    });
  });

  describe('initializeCreateProfileForm', () => {
    it('should pre-fill name and email from member document', () => {
      const form = createProfileFormGroup(fb);
      const member: Member = {
        uid: 'test-uid',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Timestamp(0, 0),
        membershipActive: true,
        slug: 'test-user',
      };

      initializeCreateProfileForm(form, member);

      expect(form.value.title).toBe('Test User');
      expect(form.value.email).toBe('test@example.com');
    });

    it('should initialize other fields as empty', () => {
      const form = createProfileFormGroup(fb);
      const member: Member = {
        uid: 'test-uid',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Timestamp(0, 0),
        membershipActive: true,
      };

      initializeCreateProfileForm(form, member);

      expect(form.value.pronouns).toBe('');
      expect(form.value.credentials).toBe('');
      expect(form.value.bio).toBe('');
      expect(form.value.businessName).toBe('');
      expect(form.value.phone).toBe('');
      expect(form.value.website).toBe('');
    });

    it('should initialize all tags as unchecked', () => {
      const form = createProfileFormGroup(fb);
      const member: Member = {
        uid: 'test-uid',
        email: 'test@example.com',
        createdAt: new Timestamp(0, 0),
        membershipActive: true,
      };

      initializeCreateProfileForm(form, member);

      const tagsArray = form.get('tags') as FormArray;
      expect(tagsArray.length).toBe(PROFILE_TAGS.length);

      for (let index = 0; index < tagsArray.length; index++) {
        expect(tagsArray.at(index).value).toBe(false);
      }
    });

    it('should handle member with no name or email', () => {
      const form = createProfileFormGroup(fb);
      const member: Member = {
        uid: 'test-uid',
        email: '',
        createdAt: new Timestamp(0, 0),
        membershipActive: false,
      };

      initializeCreateProfileForm(form, member);

      expect(form.value.title).toBe('');
      expect(form.value.email).toBe('');
    });
  });

  describe('extractProfileData', () => {
    it('should extract all filled fields correctly', () => {
      const form = createProfileFormGroup(fb);
      form.patchValue({
        title: 'Jane Doe',
        pronouns: 'she/her',
        credentials: 'CD(DONA)',
        bio: 'Experienced doula.',
        businessName: 'Gentle Birth',
        phone: '555-1234',
        email: 'jane@example.com',
        website: 'example.com',
      });

      // Set some tags as checked
      const tagsArray = form.get('tags') as FormArray;
      tagsArray.clear();
      // Birth Doula, Postpartum Doula, etc.
      tagsArray.push(fb.control(true));
      tagsArray.push(fb.control(false));
      tagsArray.push(fb.control(true));

      const profileData = extractProfileData(form);

      expect(profileData.title).toBe('Jane Doe');
      expect(profileData.pronouns).toBe('she/her');
      expect(profileData.credentials).toBe('CD(DONA)');
      expect(profileData.bio).toBe('Experienced doula.');
      expect(profileData.contact?.business_name).toBe('Gentle Birth');
      expect(profileData.contact?.phone).toBe('555-1234');
      expect(profileData.contact?.email).toBe('jane@example.com');
      expect(profileData.contact?.website).toBe('example.com');
    });

    it('should omit optional fields that are empty', () => {
      const form = createProfileFormGroup(fb);
      form.patchValue({
        title: 'Jane Doe',
        pronouns: '',
        credentials: '',
        bio: 'Bio text.',
        businessName: '',
        phone: '',
        email: '',
        website: '',
      });

      const tagsArray = form.get('tags') as FormArray;
      tagsArray.clear();
      tagsArray.push(fb.control(true));

      const profileData = extractProfileData(form);

      expect(profileData.title).toBe('Jane Doe');
      expect(profileData.bio).toBe('Bio text.');
      expect(profileData.pronouns).toBeUndefined();
      expect(profileData.credentials).toBeUndefined();
      expect(profileData.contact).toBeUndefined();
    });

    it('should filter and return only selected tags', () => {
      const form = createProfileFormGroup(fb);
      form.patchValue({
        title: 'Jane Doe',
        bio: 'Bio text.',
      });

      const tagsArray = form.get('tags') as FormArray;
      tagsArray.clear();
      // Simulate PROFILE_TAGS.length checkboxes with first 2 checked
      for (let index = 0; index < PROFILE_TAGS.length; index++) {
        tagsArray.push(fb.control(index === 0 || index === 2));
      }

      const profileData = extractProfileData(form);

      expect(profileData.tags).toEqual([PROFILE_TAGS[0], PROFILE_TAGS[2]]);
    });

    it('should omit tags if none are selected', () => {
      const form = createProfileFormGroup(fb);
      form.patchValue({
        title: 'Jane Doe',
        bio: 'Bio text.',
      });

      const tagsArray = form.get('tags') as FormArray;
      tagsArray.clear();
      const tagControls = Array.from({ length: PROFILE_TAGS.length }, () => fb.control(false));
      for (const control of tagControls) {
        tagsArray.push(control);
      }

      const profileData = extractProfileData(form);

      expect(profileData.tags).toBeUndefined();
    });

    it('should include contact object only if at least one contact field is filled', () => {
      const form = createProfileFormGroup(fb);
      form.patchValue({
        title: 'Jane Doe',
        bio: 'Bio text.',
        businessName: '',
        phone: '555-1234',
        email: '',
        website: '',
      });

      const tagsArray = form.get('tags') as FormArray;
      tagsArray.clear();
      tagsArray.push(fb.control(true));

      const profileData = extractProfileData(form);

      expect(profileData.contact).toBeDefined();
      expect(profileData.contact?.phone).toBe('555-1234');
      expect(profileData.contact?.business_name).toBeUndefined();
      expect(profileData.contact?.email).toBeUndefined();
    });
  });

  describe('markAllTouched', () => {
    it('should mark all form controls as touched', () => {
      const form = createProfileFormGroup(fb);

      // Initially, controls should not be touched
      expect(form.get('title')?.touched).toBe(false);
      expect(form.get('bio')?.touched).toBe(false);

      markAllTouched(form);

      // After marking, all controls should be touched
      expect(form.get('title')?.touched).toBe(true);
      expect(form.get('pronouns')?.touched).toBe(true);
      expect(form.get('credentials')?.touched).toBe(true);
      expect(form.get('bio')?.touched).toBe(true);
      expect(form.get('businessName')?.touched).toBe(true);
      expect(form.get('phone')?.touched).toBe(true);
      expect(form.get('email')?.touched).toBe(true);
      expect(form.get('website')?.touched).toBe(true);
      expect(form.get('tags')?.touched).toBe(true);
    });
  });
});
