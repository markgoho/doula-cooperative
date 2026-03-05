import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../../../services/profile.service';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';
import { type ContactInfo, type PersonalInfo } from '../../wizard-types';
import { PreviewStep } from './preview-step';

describe('PreviewStep', () => {
  it('should render the profile preview', async () => {
    await setup();

    expect(screen.getByText('Jane Doe')).toBeVisible();
    expect(screen.getByText('I am a doula.')).toBeVisible();
  });

  it('should show edit links', async () => {
    await setup();

    expect(screen.getAllByText('Edit').length).toBeGreaterThan(0);
  });

  it('should navigate to edit step when edit is clicked', async () => {
    const { user, mockRouter } = await setup();

    const editButtons = screen.getAllByLabelText(/Edit/);
    const personalEditButton = editButtons.find((button) =>
      button.getAttribute('aria-label')?.includes('personal'),
    );
    expect(personalEditButton).toBeDefined();
    await user.click(personalEditButton!);
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/personal']);
  });

  it('should create profile, reset wizard, and navigate to /profile on finish', async () => {
    const { user, mockRouter, wizardService, mockProfileService } = await setup();

    expect(wizardService.personalInfo().title).toBe('Jane Doe');

    const finishButton = screen.getByRole('button', { name: 'Finish' });
    await user.click(finishButton);

    await waitFor(() => {
      expect(mockProfileService.createProfileContent).toHaveBeenCalled();
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile']);
    });

    await vi.waitFor(() => {
      expect(wizardService.personalInfo().title).toBe('');
      expect(wizardService.selectedTags()).toEqual([]);
      expect(wizardService.bio()).toBe('');
      expect(wizardService.contactInfo().email).toBe('');
      expect(wizardService.completedSteps().size).toBe(0);
      expect(wizardService.resolvedSlug()).toBe('');
      expect(wizardService.initialized()).toBe(false);
    });
  });

  it('should show error when profile creation fails', async () => {
    const { user } = await setup({ createShouldFail: true });

    const finishButton = screen.getByRole('button', { name: 'Finish' });
    await user.click(finishButton);

    expect(await screen.findByText('Profile creation error')).toBeVisible();
  });

  it('should show loading state during profile creation', async () => {
    const { user } = await setup({ delayCreate: true });

    const finishButton = screen.getByRole('button', { name: 'Finish' });
    const clickPromise = user.click(finishButton);

    await waitFor(() => {
      expect(screen.getByText('Creating Profile...')).toBeVisible();
    });

    await clickPromise;
  });

  it('should send assembled profile data to createProfileContent', async () => {
    const { user, mockProfileService } = await setup({
      personalInfo: { title: 'Sarah Smith', pronouns: 'they/them', credentials: 'CPD' },
      tags: ['Postpartum Doula', 'Lactation Support'],
      bio: 'Supporting families with care.',
      contactInfo: {
        businessName: 'Smith Doula Services',
        phone: '555-9876',
        email: 'sarah@example.com',
        website: 'sarahdoula.com',
      },
    });

    const finishButton = screen.getByRole('button', { name: 'Finish' });
    await user.click(finishButton);

    await waitFor(() => {
      expect(mockProfileService.createProfileContent).toHaveBeenCalled();
    });

    const profileData = mockProfileService.createProfileContent.mock.calls[0]![0];
    expect(profileData.title).toBe('Sarah Smith');
    expect(profileData.pronouns).toBe('they/them');
    expect(profileData.credentials).toBe('CPD');
    expect(profileData.bio).toBe('Supporting families with care.');
    expect(profileData.tags).toEqual(['Postpartum Doula', 'Lactation Support']);
    expect(profileData.contact).toEqual({
      business_name: 'Smith Doula Services',
      phone: '555-9876',
      email: 'sarah@example.com',
      website: 'sarahdoula.com',
    });
  });

  it('should display assembled profile data from real service', async () => {
    await setup({
      personalInfo: { title: 'Sarah Smith', pronouns: 'they/them', credentials: 'CPD' },
      tags: ['Postpartum Doula', 'Lactation Support'],
      bio: 'Supporting families with care.',
      contactInfo: {
        businessName: 'Smith Doula Services',
        phone: '555-9876',
        email: 'sarah@example.com',
        website: 'sarahdoula.com',
      },
    });

    expect(screen.getByText('Sarah Smith')).toBeVisible();
    expect(screen.getByText('they/them')).toBeVisible();
    expect(screen.getByText('CPD')).toBeVisible();
    expect(screen.getByText('Supporting families with care.')).toBeVisible();
    expect(screen.getByText('Postpartum Doula')).toBeVisible();
    expect(screen.getByText('Lactation Support')).toBeVisible();
    expect(screen.getByText('Smith Doula Services')).toBeVisible();
    expect(screen.getByText('sarah@example.com')).toBeVisible();
  });
});

interface SetupOptions {
  personalInfo?: PersonalInfo;
  tags?: string[];
  bio?: string;
  contactInfo?: ContactInfo;
  createShouldFail?: boolean;
  delayCreate?: boolean;
}

async function setup({
  personalInfo = { title: 'Jane Doe', pronouns: '', credentials: '' },
  tags = [],
  bio = 'I am a doula.',
  contactInfo,
  createShouldFail = false,
  delayCreate = false,
}: SetupOptions = {}) {
  const mockProfileService = {
    profileImageUrl: signal(undefined),
    createProfileContent: vi.fn().mockImplementation(async () => {
      if (delayCreate) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (createShouldFail) {
        throw new Error('Profile creation error');
      }
    }),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  const result = await render(PreviewStep, {
    providers: [
      { provide: ProfileService, useValue: mockProfileService },
      { provide: Router, useValue: mockRouter },
    ],
    configureTestBed: (testBed) => {
      const wizardService = testBed.inject(CreateProfileWizardService);
      wizardService.reset();
      wizardService.personalInfo.set(personalInfo);
      wizardService.selectedTags.set(tags);
      wizardService.bio.set(bio);
      if (contactInfo) {
        wizardService.contactInfo.set(contactInfo);
      }
    },
  });

  const wizardService = TestBed.inject(CreateProfileWizardService);
  const user = userEvent.setup();

  return { ...result, user, mockRouter, wizardService, mockProfileService };
}
