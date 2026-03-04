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

  it('should initialize wizard from member document', async () => {
    const { mockWizardService, mockMembershipService } = await setup({ userDocumentLoading: true });

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
      expect(mockWizardService.initializeFromMember).toHaveBeenCalled();
    });
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

  const mockWizardService = {
    initializeFromMember: vi.fn(),
    completedSteps: signal(new Set()),
    currentStepIndex: signal(0),
    initialized: signal(false),
  };

  const result = await render(CreateProfileWizard, {
    providers: [
      provideRouter([]),
      { provide: MembershipService, useValue: mockMembershipService },
      { provide: CreateProfileWizardService, useValue: mockWizardService },
    ],
  });

  const router = TestBed.inject(Router);

  return { ...result, router, mockWizardService, mockMembershipService };
}
