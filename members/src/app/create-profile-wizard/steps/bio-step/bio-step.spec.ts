import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';
import { BioStep } from './bio-step';

describe('BioStep', () => {
  it('should pre-fill bio from wizard service', async () => {
    await setup({ bio: 'Existing bio text' });

    const bioInput = screen.getByLabelText('Bio *') as HTMLTextAreaElement;
    expect(bioInput.value).toBe('Existing bio text');
  });

  it('should show validation error when bio is empty', async () => {
    const { user } = await setup({ bio: 'text' });

    const bioInput = screen.getByLabelText('Bio *');
    await user.clear(bioInput);
    await user.tab();

    expect(await screen.findByText('Bio is required')).toBeVisible();
  });

  it('should save bio and navigate to contact step on Next', async () => {
    const { user, mockRouter, mockWizardService } = await setup({ bio: 'My bio' });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    expect(mockWizardService.bio.set).toHaveBeenCalledWith('My bio');
    expect(mockWizardService.completeStep).toHaveBeenCalledWith('bio');
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/contact']);
  });

  it('should navigate back to tags step', async () => {
    const { user, mockRouter } = await setup({ bio: 'text' });

    const backButton = screen.getByRole('button', { name: 'Back' });
    await user.click(backButton);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/tags']);
  });

  it('should disable Next button when bio is empty', async () => {
    await setup({ bio: '' });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    expect(nextButton).toBeDisabled();
  });
});

interface SetupOptions {
  bio?: string;
}

async function setup({ bio = '' }: SetupOptions = {}) {
  const mockWizardService = {
    bio: Object.assign(signal(bio), { set: vi.fn() }),
    completeStep: vi.fn(),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  await render(BioStep, {
    providers: [
      { provide: CreateProfileWizardService, useValue: mockWizardService },
      { provide: Router, useValue: mockRouter },
    ],
  });

  const user = userEvent.setup();

  return { user, mockRouter, mockWizardService };
}
