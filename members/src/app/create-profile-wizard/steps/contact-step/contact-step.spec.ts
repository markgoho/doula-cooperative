import { TestBed } from '@angular/core/testing';
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
    const { user, mockRouter, mockProfileService, wizardService } = await setup();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockProfileService.createProfileContent).toHaveBeenCalled();
      expect(wizardService.profileCreated()).toBe(true);
      expect(wizardService.completedSteps().has('contact')).toBe(true);
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

  it('should include required fields in profile data sent to API', async () => {
    const { user, mockProfileService } = await setup({
      personalInfo: { title: 'Jane Doe', pronouns: '', credentials: '' },
      bio: 'My bio',
    });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockProfileService.createProfileContent).toHaveBeenCalled();
    });

    const profileData = mockProfileService.createProfileContent.mock.calls[0]![0];
    expect(profileData.title).toBe('Jane Doe');
    expect(profileData.bio).toBe('My bio');
  });

  it('should include optional fields when set in profile data sent to API', async () => {
    const { user, mockProfileService } = await setup({
      personalInfo: {
        title: 'Jane Doe',
        pronouns: 'she/her',
        credentials: 'CD(DONA)',
      },
      tags: ['Birth Doula'],
      bio: 'My bio',
    });

    // Fill in contact form fields
    const businessNameInput = screen.getByLabelText('Business Name');
    const phoneInput = screen.getByLabelText('Phone');
    const emailInput = screen.getByLabelText('Email');
    const websiteInput = screen.getByLabelText('Website');

    await user.type(businessNameInput, 'My Business');
    await user.type(phoneInput, '555-1234');
    await user.type(emailInput, 'jane@example.com');
    await user.type(websiteInput, 'jane.com');

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockProfileService.createProfileContent).toHaveBeenCalled();
    });

    const profileData = mockProfileService.createProfileContent.mock.calls[0]![0];
    expect(profileData.pronouns).toBe('she/her');
    expect(profileData.credentials).toBe('CD(DONA)');
    expect(profileData.tags).toEqual(['Birth Doula']);
    expect(profileData.contact).toEqual({
      business_name: 'My Business',
      phone: '555-1234',
      email: 'jane@example.com',
      website: 'jane.com',
    });
  });

  it('should omit empty optional fields from profile data', async () => {
    const { user, mockProfileService } = await setup({
      personalInfo: { title: 'Jane Doe', pronouns: '', credentials: '' },
      bio: 'My bio',
    });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockProfileService.createProfileContent).toHaveBeenCalled();
    });

    const profileData = mockProfileService.createProfileContent.mock.calls[0]![0];
    expect(profileData.pronouns).toBeUndefined();
    expect(profileData.credentials).toBeUndefined();
    expect(profileData.tags).toBeUndefined();
    expect(profileData.contact).toBeUndefined();
  });

  it('should omit contact when all contact fields are empty', async () => {
    const { user, mockProfileService } = await setup({
      personalInfo: { title: 'Jane', pronouns: '', credentials: '' },
      bio: 'Bio',
    });

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockProfileService.createProfileContent).toHaveBeenCalled();
    });

    const profileData = mockProfileService.createProfileContent.mock.calls[0]![0];
    expect(profileData.contact).toBeUndefined();
  });

  it('should mark contact step as completed after creation', async () => {
    const { user, wizardService } = await setup();

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(wizardService.completedSteps().has('contact')).toBe(true);
    });
  });

  it('should set profileCreated to true after creation', async () => {
    const { user, wizardService } = await setup();

    expect(wizardService.profileCreated()).toBe(false);

    const nextButton = screen.getByRole('button', { name: 'Next' });
    await user.click(nextButton);

    await waitFor(() => {
      expect(wizardService.profileCreated()).toBe(true);
    });
  });
});

interface SetupOptions {
  contactInfo?: {
    businessName: string;
    phone: string;
    email: string;
    website: string;
  };
  personalInfo?: {
    title: string;
    pronouns: string;
    credentials: string;
  };
  tags?: string[];
  bio?: string;
  createShouldFail?: boolean;
  delayCreate?: boolean;
}

async function setup({
  contactInfo = { businessName: '', phone: '', email: '', website: '' },
  personalInfo,
  tags,
  bio,
  createShouldFail = false,
  delayCreate = false,
}: SetupOptions = {}) {
  const mockProfileService = {
    createProfileContent: vi.fn().mockImplementation(async () => {
      if (delayCreate) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (createShouldFail) {
        throw new Error('Profile creation error');
      }
    }),
    updateProfile: vi.fn().mockResolvedValue(undefined),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  const result = await render(ContactStep, {
    providers: [
      { provide: ProfileService, useValue: mockProfileService },
      { provide: Router, useValue: mockRouter },
    ],
    configureTestBed: (testBed) => {
      // Pre-populate wizard service BEFORE the component is created
      // so the form reads correct initial values from the constructor
      const wizardService = testBed.inject(CreateProfileWizardService);
      wizardService.reset();
      wizardService.contactInfo.set(contactInfo);
      if (personalInfo) {
        wizardService.personalInfo.set(personalInfo);
      }
      if (tags) {
        wizardService.selectedTags.set(tags);
      }
      if (bio) {
        wizardService.bio.set(bio);
      }
    },
  });

  const wizardService = TestBed.inject(CreateProfileWizardService);
  const user = userEvent.setup();

  return { ...result, user, mockRouter, wizardService, mockProfileService };
}
