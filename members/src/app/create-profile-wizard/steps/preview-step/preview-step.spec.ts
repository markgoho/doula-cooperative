import { signal } from '@angular/core';
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
    const personalEditButton = editButtons.find((btn) =>
      btn.getAttribute('aria-label')?.includes('personal'),
    );
    if (personalEditButton) {
      await user.click(personalEditButton);
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/personal']);
    }
  });

  it('should reset wizard and navigate to /profile on finish', async () => {
    const { user, mockRouter, mockWizardService } = await setup();

    const finishButton = screen.getByRole('button', { name: 'Finish' });
    await user.click(finishButton);

    expect(mockWizardService.reset).toHaveBeenCalled();
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile']);
  });
});

async function setup() {
  const mockWizardService = {
    buildProfileData: vi.fn().mockReturnValue({
      title: 'Jane Doe',
      bio: 'I am a doula.',
      tags: ['Birth Doula'],
      contact: { email: 'jane@example.com' },
    }),
    reset: vi.fn(),
  };

  const mockProfileService = {
    profileImageUrl: signal(undefined),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  const result = await render(PreviewStep, {
    providers: [
      { provide: CreateProfileWizardService, useValue: mockWizardService },
      { provide: ProfileService, useValue: mockProfileService },
      { provide: Router, useValue: mockRouter },
    ],
  });

  const user = userEvent.setup();

  return { ...result, user, mockRouter, mockWizardService };
}
