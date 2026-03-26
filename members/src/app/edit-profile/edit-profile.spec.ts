import { signal } from '@angular/core';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
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

    it('should show profile load error when profile fails to load and no slug exists', async () => {
      await setup({ hasProfile: false, userHasSlug: false });

      expect(screen.getByText('Profile Setup Required')).toBeVisible();
    });
  });

  describe('error state', () => {
    it('should show error message with retry button when profile fails to load', async () => {
      await setup({ hasProfile: false });

      expect(screen.getByText('Profile Load Error')).toBeVisible();
      expect(screen.getByRole('button', { name: /Retry/i })).toBeVisible();
    });

    it('should call reload when retry button is clicked', async () => {
      const { user, mockProfileService } = await setup({ hasProfile: false });

      const retryButton = screen.getByRole('button', { name: /Retry/i });
      await user.click(retryButton);

      expect(mockProfileService.profileResource.reload).toHaveBeenCalled();
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
    it('should reset form to original values when cancel is clicked after changes', async () => {
      const { user } = await setup();

      const titleInput = screen.getByLabelText('Name *') as HTMLInputElement;
      await user.clear(titleInput);
      await user.type(titleInput, 'Modified Name');

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(titleInput.value).toBe('Jane Doe');
    });

    it('should clear error messages when cancel is clicked after changes', async () => {
      const { user } = await setup({ updateShouldFail: true });

      const submitButton = screen.getByRole('button', { name: 'Save Profile' });
      await user.click(submitButton);

      expect(await screen.findByText(/failed to update profile/i)).toBeVisible();

      // Make a change so the form is dirty, then cancel
      const titleInput = screen.getByLabelText('Name *');
      await user.type(titleInput, 'x');

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(screen.queryByText(/failed to update profile/i)).not.toBeInTheDocument();
    });

    it('should show info message when cancel is clicked with no changes', async () => {
      const { user } = await setup();

      const cancelButton = screen.getByRole('button', { name: 'Cancel' });
      await user.click(cancelButton);

      expect(screen.getByText('No changes to discard.')).toBeVisible();
    });
  });

  describe('profile image', () => {
    it('should display profile image using profileImageUrl', async () => {
      await setup();

      const image = screen.getByRole('img', { name: /profile image of jane doe/i });
      expect(image.getAttribute('src')).toContain('ik.imagekit.io');
      expect(image.getAttribute('src')).toContain('di-default-profile.png');
    });

    it('should show edit profile image link', async () => {
      await setup();

      const editImageLink = screen.getByRole('link', { name: 'Edit Profile Image' });
      expect(editImageLink).toHaveAttribute('href', '/profile/image');
    });

    it('should show default image message when no custom image is set', async () => {
      await setup({ hasCustomImage: false });

      expect(screen.getByText(/no custom profile image set/i)).toBeVisible();
    });

    it('should not show default image message when custom image exists', async () => {
      await setup({ hasCustomImage: true });

      expect(screen.queryByText(/no custom profile image set/i)).not.toBeInTheDocument();
    });

    it('should show default placeholder alt text when no custom image', async () => {
      await setup({ hasCustomImage: false });

      expect(screen.getByRole('img', { name: /default profile placeholder/i })).toBeVisible();
    });
  });
});

interface SetupOptions {
  profileData?: ProfileData;
  hasProfile?: boolean;
  hasCustomImage?: boolean;
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
  hasCustomImage = true,
  updateShouldFail = false,
  errorMessage,
  delayUpdate = false,
  userDocumentLoading = false,
  userHasSlug = true,
  profileResourceLoading = false,
}: SetupOptions = {}) {
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
      createdAt: new Date(0),
      isAdmin: false,
      slug: 'jane-doe',
      profileCreatedAt: new Date(0),
      membershipActive: true,
    };
  } else {
    mockMemberDocument = {
      uid: 'test-uid',
      email: 'test@example.com',
      createdAt: new Date(0),
      isAdmin: false,
      membershipActive: true,
    };
  }

  const mockMembershipService = {
    userDocument: signal(mockMemberDocument),
  };

  const profileValue = hasProfile ? (profileData ?? defaultProfile) : undefined;

  // When loading, profile() should return undefined (no data available yet)
  const profileSignalValue = profileResourceLoading ? undefined : profileValue;

  const resolveStatus = (): string => {
    if (profileResourceLoading) return 'loading';
    if (!hasProfile && userHasSlug) return 'error';
    if (profileValue !== undefined) return 'resolved';
    return 'idle';
  };

  const mockProfileService = {
    profile: signal(profileSignalValue),
    loadProfile: vi.fn(),
    profileImageUrl: signal(
      hasProfile && userHasSlug
        ? 'https://ik.imagekit.io/doulacoop/tr:w-300,h-300,fo-face,z-0.5,di-default-profile.png/doulas/jane-doe/jane-doe-profile'
        : undefined,
    ),
    hasCustomImage: signal(hasCustomImage),
    profileResource: {
      isLoading: signal(profileResourceLoading),
      hasValue: vi.fn(() => !profileResourceLoading && profileValue !== undefined),
      value: vi.fn(() => profileValue),
      error: vi.fn(() => (!hasProfile && userHasSlug ? new Error('Profile not found') : undefined)),
      status: signal(resolveStatus()),
      reload: vi.fn(),
    },
    getTagUrl: vi.fn((tag: string) => `/doulas/tag/${tag.toLowerCase().replaceAll(/\s+/g, '-')}`),
    updateProfile: vi.fn().mockImplementation(async () => {
      if (delayUpdate) {
        await new Promise((resolve) => setTimeout(resolve, 100));
      }
      if (updateShouldFail) {
        throw errorMessage ? new Error(errorMessage) : 'Unknown error';
      }
    }),
  };

  await render(EditProfile, {
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

  // IMPORTANT: Call userEvent.setup() AFTER render() to avoid ApplicationRef destroyed warnings
  const user = userEvent.setup();

  return { user, mockProfileService };
}
