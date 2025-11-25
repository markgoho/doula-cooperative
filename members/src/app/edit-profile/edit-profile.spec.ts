import { signal } from '@angular/core';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from '../../test-utils/timestamp-mock';
import { MembershipService, type Member } from '../services/membership.service';
import { ProfileService } from '../services/profile.service';
import { type ProfileData } from '../types/profile-data';
import { EditProfile } from './edit-profile';

describe('EditProfile', () => {
  describe('loading states', () => {
    it('should show loading message while user document is loading', async () => {
      await setup({ userDocumentLoading: true });

      expect(screen.getByText('Loading your profile...')).toBeVisible();
    });

    it('should show loading message while profile resource is loading', async () => {
      await setup({ profileResourceLoading: true });

      expect(screen.getByText('Loading your profile...')).toBeVisible();
    });
  });

  describe('no profile state', () => {
    it('should show profile setup message when user has no slug', async () => {
      await setup({ userHasSlug: false });

      expect(screen.getByText('Profile Setup Required')).toBeVisible();
    });

    it('should show membership page link when user has no slug', async () => {
      await setup({ userHasSlug: false });

      const membershipLink = screen.getByRole('link', { name: 'Membership page' });
      expect(membershipLink).toHaveAttribute('href', '/membership');
    });

    it('should show profile load error when profile fails to load', async () => {
      await setup({ hasProfile: false, userHasSlug: true });

      expect(screen.getByText('Profile Load Error')).toBeVisible();
    });
  });

  describe('form initialization', () => {
    it('should populate form with profile data', async () => {
      await setup();

      const titleInput = screen.getByLabelText('Name *') as HTMLInputElement;
      const credentialsInput = screen.getByLabelText('Credentials') as HTMLInputElement;
      const bioInput = screen.getByLabelText('Bio *') as HTMLTextAreaElement;

      expect(titleInput.value).toBe('Jane Doe');
      expect(credentialsInput.value).toBe('CD(DONA), CPD');
      expect(bioInput.value).toBe('Experienced doula serving families with compassion.');
    });

    it('should populate contact information fields', async () => {
      await setup();

      const businessNameInput = screen.getByLabelText('Business Name') as HTMLInputElement;
      const phoneInput = screen.getByLabelText('Phone') as HTMLInputElement;
      const emailInput = screen.getByLabelText('Email') as HTMLInputElement;
      const websiteInput = screen.getByLabelText('Website') as HTMLInputElement;

      expect(businessNameInput.value).toBe('Gentle Birth Support');
      expect(phoneInput.value).toBe('555-123-4567');
      expect(emailInput.value).toBe('jane@example.com');
      expect(websiteInput.value).toBe('example.com');
    });

    it('should check selected tags', async () => {
      await setup();

      const birthDoulaCheckbox = screen.getByRole('checkbox', {
        name: 'Birth Doula',
      }) as HTMLInputElement;
      const postpartumDoulaCheckbox = screen.getByRole('checkbox', {
        name: 'Postpartum Doula',
      }) as HTMLInputElement;

      expect(birthDoulaCheckbox.checked).toBe(true);
      expect(postpartumDoulaCheckbox.checked).toBe(true);
    });
  });

  describe('form validation', () => {
    it('should show validation error when title is empty', async () => {
      const { user } = await setup();

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);
      await user.tab();

      expect(await screen.findByText('Name is required')).toBeVisible();
    });

    it('should show validation error when bio is empty', async () => {
      const { user } = await setup();

      const bioInput = screen.getByLabelText('Bio *');
      await user.clear(bioInput);
      await user.tab();

      expect(await screen.findByText('Bio is required')).toBeVisible();
    });

    it('should show validation error for invalid email', async () => {
      const { user } = await setup();

      const emailInput = screen.getByLabelText('Email');
      await user.clear(emailInput);
      await user.type(emailInput, 'invalid-email');
      await user.tab();

      expect(await screen.findByText('Please enter a valid email address')).toBeVisible();
    });

    it('should disable submit button when form is invalid', async () => {
      const { user } = await setup();

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      expect(submitButton).toBeDisabled();
    });

    it('should enable submit button when form is valid', async () => {
      await setup();

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      expect(submitButton).not.toBeDisabled();
    });
  });

  describe('form submission', () => {
    it('should display error message when update fails', async () => {
      const { user } = await setup({ updateShouldFail: true, errorMessage: 'Update failed' });

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      await user.click(submitButton);

      expect(await screen.findByText(/Update failed/i)).toBeVisible();
    });

    it('should display generic error message for unknown errors', async () => {
      const { user } = await setup({ updateShouldFail: true });

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      await user.click(submitButton);

      expect(await screen.findByText(/failed to update profile/i)).toBeVisible();
    });

    it('should display success message after successful update', async () => {
      const { user } = await setup();

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      await user.click(submitButton);

      expect(await screen.findByText(/profile updated successfully/i)).toBeVisible();
    });

    it('should show loading state during submission', async () => {
      const { user } = await setup({ delayUpdate: true });

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      const clickPromise = user.click(submitButton);

      // Wait for loading state to appear
      await waitFor(() => {
        expect(screen.getByText(/Saving/i)).toBeVisible();
      });

      await clickPromise;
    });

    it('should disable submit button during submission', async () => {
      const { user } = await setup({ delayUpdate: true });

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      const clickPromise = user.click(submitButton);

      // Wait for button to be disabled
      await waitFor(() => {
        expect(submitButton).toBeDisabled();
      });

      await clickPromise;
    });

    it('should call updateProfile with correct data', async () => {
      const { user, mockProfileService } = await setup();

      const titleInput = screen.getByLabelText('Name *');
      await user.clear(titleInput);
      await user.type(titleInput, 'New Name');

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockProfileService.updateProfile).toHaveBeenCalledWith(
          expect.objectContaining({
            title: 'New Name',
          }),
        );
      });
    });
  });

  describe('cancel functionality', () => {
    it('should reset form to original values when cancel is clicked', async () => {
      const { user } = await setup();

      const titleInput = screen.getByLabelText('Name *') as HTMLInputElement;
      await user.clear(titleInput);
      await user.type(titleInput, 'Modified Name');

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(titleInput.value).toBe('Jane Doe');
    });

    it('should clear error messages when cancel is clicked', async () => {
      const { user } = await setup({ updateShouldFail: true });

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      await user.click(submitButton);

      expect(await screen.findByText(/failed to update profile/i)).toBeVisible();

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(screen.queryByText(/failed to update profile/i)).not.toBeInTheDocument();
    });
  });

  describe('profile image', () => {
    it('should display profile image when present', async () => {
      await setup();

      const image = screen.getByRole('img', { name: 'Profile image' }) as HTMLImageElement;
      expect(image.src).toContain('jane.jpg');
    });

    it('should show edit profile image link', async () => {
      await setup();

      const editImageLink = screen.getByRole('link', { name: 'Edit Profile Image' });
      expect(editImageLink).toHaveAttribute('href', '/profile/image');
    });
  });
});

interface SetupOptions {
  profileData?: ProfileData;
  hasProfile?: boolean;
  updateShouldFail?: boolean;
  errorMessage?: string;
  delayUpdate?: boolean;
  userDocumentLoading?: boolean;
  userHasSlug?: boolean;
  profileResourceLoading?: boolean;
}

async function setup({
  profileData,
  hasProfile = true,
  updateShouldFail = false,
  errorMessage,
  delayUpdate = false,
  userDocumentLoading = false,
  userHasSlug = true,
  profileResourceLoading = false,
}: SetupOptions = {}) {
  const user = userEvent.setup();

  const defaultProfile: ProfileData = {
    title: 'Jane Doe',
    credentials: 'CD(DONA), CPD',
    bio: 'Experienced doula serving families with compassion.',
    image: 'https://example.com/jane.jpg',
    tags: ['Birth Doula', 'Postpartum Doula'],
    contact: {
      business_name: 'Gentle Birth Support',
      website: 'example.com',
      phone: '555-123-4567',
      email: 'jane@example.com',
    },
  };

  let mockMemberDocument: Member | undefined;
  if (userDocumentLoading) {
    mockMemberDocument = undefined;
  } else if (userHasSlug) {
    mockMemberDocument = {
      uid: 'test-uid',
      email: 'test@example.com',
      createdAt: new Timestamp(0, 0),
      slug: 'jane-doe',
      membershipActive: true,
    };
  } else {
    mockMemberDocument = {
      uid: 'test-uid',
      email: 'test@example.com',
      createdAt: new Timestamp(0, 0),
      membershipActive: true,
    };
  }

  const mockMembershipService = {
    userDocument: signal(mockMemberDocument),
  };

  const profileValue = hasProfile ? (profileData ?? defaultProfile) : undefined;

  const mockProfileService = {
    profile: signal(profileValue),
    profileResource: {
      isLoading: vi.fn(() => profileResourceLoading),
      hasValue: vi.fn(() => !profileResourceLoading && profileValue !== undefined),
      value: vi.fn(() => profileValue),
    },
    getTagUrl: vi.fn((tag: string) => `/doulas/tag/${tag.toLowerCase().replaceAll(/\s+/g, '-')}`),
    updateProfile: vi.fn().mockImplementation(async () => {
      if (delayUpdate) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (updateShouldFail) {
        throw errorMessage ? new Error(errorMessage) : new Error('Unknown error');
      }
    }),
  };

  const result = await render(EditProfile, {
    providers: [
      {
        provide: ProfileService,
        useValue: mockProfileService,
      },
      {
        provide: MembershipService,
        useValue: mockMembershipService,
      },
    ],
  });

  return { ...result, user, mockProfileService, mockMembershipService };
}
