import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../../../services/profile.service';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';
import { PreviewStep } from './preview-step';

describe('PreviewStep', () => {
  it('should render the profile preview', async () => {
    await setup();

    expect(screen.getByText('Jane Doe')).toBeVisible();
    expect(screen.getByText('I am a doula.')).toBeVisible();
  });

  it('should show success message', async () => {
    await setup();

    expect(screen.getByText(/Your profile has been created/)).toBeVisible();
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

  it('should reset wizard and navigate to /profile on finish', async () => {
    const { user, mockRouter, wizardService } = await setup();

    // Verify state is populated before clicking Finish
    expect(wizardService.personalInfo().title).toBe('Jane Doe');

    const finishButton = screen.getByRole('button', { name: 'Finish' });
    await user.click(finishButton);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile']);

    // Verify all wizard state is reset after Finish
    expect(wizardService.personalInfo().title).toBe('');
    expect(wizardService.selectedTags()).toEqual([]);
    expect(wizardService.bio()).toBe('');
    expect(wizardService.contactInfo().email).toBe('');
    expect(wizardService.completedSteps().size).toBe(0);
    expect(wizardService.profileCreated()).toBe(false);
    expect(wizardService.resolvedSlug()).toBe('');
    expect(wizardService.initialized()).toBe(false);
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
  personalInfo?: { title: string; pronouns: string; credentials: string };
  tags?: string[];
  bio?: string;
  contactInfo?: {
    businessName: string;
    phone: string;
    email: string;
    website: string;
  };
}

async function setup({
  personalInfo = { title: 'Jane Doe', pronouns: '', credentials: '' },
  tags = [],
  bio = 'I am a doula.',
  contactInfo,
}: SetupOptions = {}) {
  const mockProfileService = {
    profileImageUrl: signal(undefined),
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

  return { ...result, user, mockRouter, wizardService };
}
