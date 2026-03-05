import { signal, type WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import { describe, expect, it, vi } from 'vitest';
import { MembershipService, type Member } from '../services/membership.service';
import { CreateProfileWizardService } from './create-profile-wizard.service';
import { CreateProfileWizard } from './create-profile-wizard';

describe('CreateProfileWizard', () => {
  it('should show loading message while user document is loading', async () => {
    await setup({ userDocumentLoading: true });

    expect(screen.getByText('Loading...')).toBeVisible();
  });

  it('should show step indicator when user document is loaded', async () => {
    await setup();

    expect(screen.getByRole('navigation', { name: 'Profile creation progress' })).toBeVisible();
  });

  it('should redirect to /profile if user already has a profile', async () => {
    const { router, mockMembershipService } = await setup({ userDocumentLoading: true });
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const memberWithProfile: Member = {
      uid: 'test-uid',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(0),
      isAdmin: false,
      membershipActive: true,
      slug: 'test-user',
      profileCreatedAt: new Date(),
    };
    mockMembershipService.userDocument.set(memberWithProfile);
    TestBed.flushEffects();

    await waitFor(() => {
      expect(navigateSpy).toHaveBeenCalled();
    });
  });

  it('should pre-fill personal info from member document', async () => {
    const { wizardService, mockMembershipService } = await setup({ userDocumentLoading: true });

    const member: Member = {
      uid: 'test-uid',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(0),
      isAdmin: false,
      membershipActive: true,
      slug: 'test-user',
    };
    mockMembershipService.userDocument.set(member);
    TestBed.flushEffects();

    await waitFor(() => {
      expect(wizardService.personalInfo().title).toBe('Test User');
    });
  });

  it('should pre-fill email from member document', async () => {
    const { wizardService, mockMembershipService } = await setup({ userDocumentLoading: true });

    const member: Member = {
      uid: 'test-uid',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(0),
      isAdmin: false,
      membershipActive: true,
      slug: 'test-user',
    };
    mockMembershipService.userDocument.set(member);
    TestBed.flushEffects();

    await waitFor(() => {
      expect(wizardService.contactInfo().email).toBe('test@example.com');
    });
  });

  it('should pre-fill resolved slug from member document', async () => {
    const { wizardService, mockMembershipService } = await setup({ userDocumentLoading: true });

    const member: Member = {
      uid: 'test-uid',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(0),
      isAdmin: false,
      membershipActive: true,
      slug: 'test-user',
    };
    mockMembershipService.userDocument.set(member);
    TestBed.flushEffects();

    await waitFor(() => {
      expect(wizardService.resolvedSlug()).toBe('test-user');
    });
  });

  it('should only initialize once from member document', async () => {
    const { wizardService, mockMembershipService } = await setup({ userDocumentLoading: true });

    const member: Member = {
      uid: 'test-uid',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(0),
      isAdmin: false,
      membershipActive: true,
      slug: 'test-user',
    };
    mockMembershipService.userDocument.set(member);
    TestBed.flushEffects();

    await waitFor(() => {
      expect(wizardService.personalInfo().title).toBe('Test User');
    });

    // Manually change the title after initialization
    wizardService.personalInfo.set({ title: 'Changed', pronouns: '', credentials: '' });

    // Re-set member document to trigger the effect again
    mockMembershipService.userDocument.set({ ...member, name: 'Another Name' });
    TestBed.flushEffects();

    // Title should still be the manually changed value, not re-initialized
    expect(wizardService.personalInfo().title).toBe('Changed');
  });

  it('should handle member without name', async () => {
    const { wizardService, mockMembershipService } = await setup({ userDocumentLoading: true });

    const member = {
      uid: 'test-uid',
      email: 'test@example.com',
      createdAt: new Date(0),
      isAdmin: false,
      membershipActive: true,
      slug: 'test-user',
    } as Member;
    mockMembershipService.userDocument.set(member);
    TestBed.flushEffects();

    await waitFor(() => {
      expect(wizardService.initialized()).toBe(true);
    });

    expect(wizardService.personalInfo().title).toBe('');
  });

  it('should not redirect to /profile when profileCreatedAt is not set', async () => {
    const { mockMembershipService, router } = await setup({
      userDocumentLoading: true,
    });
    const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

    const member: Member = {
      uid: 'test-uid',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: new Date(0),
      isAdmin: false,
      membershipActive: true,
      slug: 'test-user',
    };
    mockMembershipService.userDocument.set(member);
    TestBed.flushEffects();

    // Should NOT redirect — no profileCreatedAt means profile hasn't been created yet
    expect(navigateSpy).not.toHaveBeenCalledWith(['/profile']);
  });

  it('should reset wizard state on destroy', async () => {
    const { wizardService, fixture } = await setup();

    // Populate wizard state
    wizardService.personalInfo.set({ title: 'Jane', pronouns: 'she/her', credentials: 'CD' });
    wizardService.selectedTags.set(['Birth Doula']);
    wizardService.bio.set('Bio text');
    wizardService.contactInfo.set({
      businessName: 'Biz',
      phone: '555',
      email: 'e@e.com',
      website: 'w.com',
    });
    wizardService.completeStep('personal');
    wizardService.resolvedSlug.set('jane');

    // Destroy the component
    fixture.destroy();

    // Verify all state is reset
    expect(wizardService.personalInfo().title).toBe('');
    expect(wizardService.selectedTags()).toEqual([]);
    expect(wizardService.bio()).toBe('');
    expect(wizardService.contactInfo().email).toBe('');
    expect(wizardService.completedSteps().size).toBe(0);
    expect(wizardService.resolvedSlug()).toBe('');
    expect(wizardService.initialized()).toBe(false);
  });
});

interface SetupOptions {
  userDocumentLoading?: boolean;
}

async function setup({ userDocumentLoading = false }: SetupOptions = {}) {
  const mockMember: Member | undefined = userDocumentLoading
    ? undefined
    : {
        uid: 'test-uid',
        email: 'test@example.com',
        name: 'Test User',
        createdAt: new Date(0),
        isAdmin: false,
        membershipActive: true,
        slug: 'test-user',
      };

  const mockMembershipService = {
    userDocument: signal(mockMember) as WritableSignal<Member | undefined>,
    hasProfile: signal(false),
  };

  const result = await render(CreateProfileWizard, {
    providers: [provideRouter([]), { provide: MembershipService, useValue: mockMembershipService }],
  });

  const router = TestBed.inject(Router);
  const wizardService = TestBed.inject(CreateProfileWizardService);

  // Reset wizard service state for clean test isolation
  wizardService.reset();

  return { ...result, router, wizardService, mockMembershipService };
}
