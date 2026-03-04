import { signal } from '@angular/core';
import { Router } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ProfileService } from '../../../services/profile.service';
import { CreateProfileWizardService } from '../../create-profile-wizard.service';
import { ContactStep } from './contact-step';

describe('ContactStep', () => {
  it('should pre-fill contact info from wizard service', async () => {
    await setup({
      contactInfo: {
        businessName: 'My Biz',
        phone: '555-1234',
        email: 'me@example.com',
        website: 'mybiz.com',
      },
    });

    expect((screen.getByLabelText('Business Name') as HTMLInputElement).value).toBe('My Biz');
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe('555-1234');
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('me@example.com');
    expect((screen.getByLabelText('Website') as HTMLInputElement).value).toBe('mybiz.com');
  });

  it('should show validation error for invalid email', async () => {
    const { user } = await setup();

    const emailInput = screen.getByLabelText('Email');
    await user.type(emailInput, 'invalid-email');
    await user.tab();

    expect(await screen.findByText('Please enter a valid email address')).toBeVisible();
  });

  it('should call createProfileContent and navigate to image step on Next', async () => {
    const { user, mockRouter, mockProfileService, mockWizardService } = await setup();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockProfileService.createProfileContent).toHaveBeenCalled();
      expect(mockWizardService.profileCreated.set).toHaveBeenCalledWith(true);
      expect(mockWizardService.completeStep).toHaveBeenCalledWith('contact');
      expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/image']);
    });
  });

  it('should show error when profile creation fails', async () => {
    const { user } = await setup({ createShouldFail: true });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    expect(await screen.findByText('Profile creation error')).toBeVisible();
  });

  it('should show loading state during profile creation', async () => {
    const { user } = await setup({ delayCreate: true });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    const clickPromise = user.click(nextButton);

    await waitFor(() => {
      expect(screen.getByText('Creating profile...')).toBeVisible();
    });

    await clickPromise;
  });

  it('should navigate back to bio step', async () => {
    const { user, mockRouter } = await setup();

    const backButton = screen.getByRole('button', { name: 'Back' });
    await user.click(backButton);

    expect(mockRouter.navigate).toHaveBeenCalledWith(['/profile/create/bio']);
  });
});

interface SetupOptions {
  contactInfo?: {
    businessName: string;
    phone: string;
    email: string;
    website: string;
  };
  createShouldFail?: boolean;
  delayCreate?: boolean;
}

async function setup({
  contactInfo = { businessName: '', phone: '', email: '', website: '' },
  createShouldFail = false,
  delayCreate = false,
}: SetupOptions = {}) {
  const mockWizardService = {
    contactInfo: Object.assign(signal(contactInfo), { set: vi.fn() }),
    buildProfileData: vi.fn().mockReturnValue({ title: 'Test', bio: 'Bio' }),
    profileCreated: Object.assign(signal(false), { set: vi.fn() }),
    completeStep: vi.fn(),
  };

  const mockProfileService = {
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

  const result = await render(ContactStep, {
    providers: [
      { provide: CreateProfileWizardService, useValue: mockWizardService },
      { provide: ProfileService, useValue: mockProfileService },
      { provide: Router, useValue: mockRouter },
    ],
  });

  const user = userEvent.setup();

  return { ...result, user, mockRouter, mockWizardService, mockProfileService };
}
