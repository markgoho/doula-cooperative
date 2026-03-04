import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { type Member } from '../services/membership.service';
import { CreateProfileWizardService, WIZARD_STEPS } from './create-profile-wizard.service';

describe('CreateProfileWizardService', () => {
  function createService(): CreateProfileWizardService {
    TestBed.configureTestingModule({});
    return TestBed.inject(CreateProfileWizardService);
  }

  const mockMember: Member = {
    uid: 'test-uid',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: new Date(0),
    isAdmin: false,
    membershipActive: true,
    slug: 'test-user',
  };

  describe('initializeFromMember', () => {
    it('should pre-fill personal info from member document', () => {
      const service = createService();
      service.initializeFromMember(mockMember);

      expect(service.personalInfo()).toEqual({
        title: 'Test User',
        pronouns: '',
        credentials: '',
      });
    });

    it('should pre-fill email from member document', () => {
      const service = createService();
      service.initializeFromMember(mockMember);

      expect(service.contactInfo().email).toBe('test@example.com');
    });

    it('should pre-fill resolved slug from member document', () => {
      const service = createService();
      service.initializeFromMember(mockMember);

      expect(service.resolvedSlug()).toBe('test-user');
    });

    it('should only initialize once', () => {
      const service = createService();
      service.initializeFromMember(mockMember);
      service.personalInfo.set({ title: 'Changed', pronouns: '', credentials: '' });

      service.initializeFromMember(mockMember);

      expect(service.personalInfo().title).toBe('Changed');
    });

    it('should handle member without name', () => {
      const service = createService();
      const { name: _, ...memberWithoutName } = mockMember;
      service.initializeFromMember(memberWithoutName as Member);

      expect(service.personalInfo().title).toBe('');
    });
  });

  describe('buildProfileData', () => {
    it('should assemble required fields', () => {
      const service = createService();
      service.personalInfo.set({ title: 'Jane Doe', pronouns: '', credentials: '' });
      service.bio.set('My bio text');

      const data = service.buildProfileData();

      expect(data.title).toBe('Jane Doe');
      expect(data.bio).toBe('My bio text');
    });

    it('should include optional fields when set', () => {
      const service = createService();
      service.personalInfo.set({
        title: 'Jane Doe',
        pronouns: 'she/her',
        credentials: 'CD(DONA)',
      });
      service.selectedTags.set(['Birth Doula']);
      service.bio.set('My bio');
      service.contactInfo.set({
        businessName: 'My Business',
        phone: '555-1234',
        email: 'jane@example.com',
        website: 'jane.com',
      });

      const data = service.buildProfileData();

      expect(data.pronouns).toBe('she/her');
      expect(data.credentials).toBe('CD(DONA)');
      expect(data.tags).toEqual(['Birth Doula']);
      expect(data.contact).toEqual({
        business_name: 'My Business',
        phone: '555-1234',
        email: 'jane@example.com',
        website: 'jane.com',
      });
    });

    it('should omit empty optional fields', () => {
      const service = createService();
      service.personalInfo.set({ title: 'Jane Doe', pronouns: '', credentials: '' });
      service.bio.set('My bio');

      const data = service.buildProfileData();

      expect(data.pronouns).toBeUndefined();
      expect(data.credentials).toBeUndefined();
      expect(data.tags).toBeUndefined();
      expect(data.contact).toBeUndefined();
    });

    it('should omit contact when all contact fields are empty', () => {
      const service = createService();
      service.personalInfo.set({ title: 'Jane', pronouns: '', credentials: '' });
      service.bio.set('Bio');
      service.contactInfo.set({ businessName: '', phone: '', email: '', website: '' });

      const data = service.buildProfileData();

      expect(data.contact).toBeUndefined();
    });
  });

  describe('canNavigateToStep', () => {
    it('should always allow navigating to step 1 (personal)', () => {
      const service = createService();
      expect(service.canNavigateToStep('personal')).toBe(true);
    });

    it('should not allow skipping to step 2 without completing step 1', () => {
      const service = createService();
      expect(service.canNavigateToStep('tags')).toBe(false);
    });

    it('should allow navigating to step 2 after step 1 is complete', () => {
      const service = createService();
      service.completeStep('personal');
      expect(service.canNavigateToStep('tags')).toBe(true);
    });

    it('should not allow step 5 (image) without profileCreated', () => {
      const service = createService();
      service.completeStep('personal');
      service.completeStep('tags');
      service.completeStep('bio');
      service.completeStep('contact');

      expect(service.canNavigateToStep('image')).toBe(false);
    });

    it('should allow step 5 (image) when profileCreated is true', () => {
      const service = createService();
      service.completeStep('personal');
      service.completeStep('tags');
      service.completeStep('bio');
      service.completeStep('contact');
      service.profileCreated.set(true);

      expect(service.canNavigateToStep('image')).toBe(true);
    });

    it('should not allow step 6 (preview) without profileCreated', () => {
      const service = createService();
      for (const step of WIZARD_STEPS.slice(0, 5)) {
        service.completeStep(step);
      }

      expect(service.canNavigateToStep('preview')).toBe(false);
    });
  });

  describe('completeStep', () => {
    it('should add step to completed set', () => {
      const service = createService();
      service.completeStep('personal');
      expect(service.completedSteps().has('personal')).toBe(true);
    });

    it('should not remove previously completed steps', () => {
      const service = createService();
      service.completeStep('personal');
      service.completeStep('tags');

      expect(service.completedSteps().has('personal')).toBe(true);
      expect(service.completedSteps().has('tags')).toBe(true);
    });
  });

  describe('getFirstIncompleteStep', () => {
    it('should return personal when nothing is completed', () => {
      const service = createService();
      expect(service.getFirstIncompleteStep()).toBe('personal');
    });

    it('should return bio when personal and tags are completed', () => {
      const service = createService();
      service.completeStep('personal');
      service.completeStep('tags');
      expect(service.getFirstIncompleteStep()).toBe('bio');
    });
  });

  describe('reset', () => {
    it('should clear all state', () => {
      const service = createService();
      service.personalInfo.set({ title: 'Jane', pronouns: 'she/her', credentials: 'CD' });
      service.selectedTags.set(['Birth Doula']);
      service.bio.set('Bio text');
      service.contactInfo.set({
        businessName: 'Biz',
        phone: '555',
        email: 'e@e.com',
        website: 'w.com',
      });
      service.completeStep('personal');
      service.profileCreated.set(true);
      service.resolvedSlug.set('jane');
      service.initialized.set(true);

      service.reset();

      expect(service.personalInfo().title).toBe('');
      expect(service.selectedTags()).toEqual([]);
      expect(service.bio()).toBe('');
      expect(service.contactInfo().email).toBe('');
      expect(service.completedSteps().size).toBe(0);
      expect(service.profileCreated()).toBe(false);
      expect(service.resolvedSlug()).toBe('');
      expect(service.initialized()).toBe(false);
    });
  });
});
