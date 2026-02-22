import { signal } from '@angular/core';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import {
  type Member,
  MembershipService,
  type UnclaimedProfile,
} from '../services/membership.service';
import { Membership } from './membership';

describe('Membership', () => {
  describe('unauthenticated state', () => {
    it('should not show any content when user is not authenticated', async () => {
      await setup({ isAuthenticated: false });

      expect(screen.queryByText(/Welcome back/)).toBeNull();
      expect(screen.queryByRole('button', { name: 'Sign Out' })).toBeNull();
    });
  });

  describe('authenticated state', () => {
    it('should display welcome message with user display name', async () => {
      await setup({
        isAuthenticated: true,
        userDisplayName: 'Jane Doe',
      });

      expect(screen.getByText('Welcome back, Jane Doe!')).toBeVisible();
    });

    it('should display welcome message with email when no display name', async () => {
      await setup({
        isAuthenticated: true,
        userEmail: 'jane@example.com',
      });

      expect(screen.getByText('Welcome back, jane@example.com!')).toBeVisible();
    });

    it('should display welcome message with fallback when no display name or email', async () => {
      await setup({
        isAuthenticated: true,
      });

      expect(screen.getByText('Welcome back, User!')).toBeVisible();
    });

    it('should show loading state when user document is not yet available', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: false,
      });

      expect(screen.getByText('Loading membership information...')).toBeVisible();
    });

    it('should display account details section when user document is available', async () => {
      const createdAt = new Date('2024-01-15T12:00:00Z');
      const subscriptionStart = new Date('2024-02-01T12:00:00Z');

      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt,
          email: 'jane@example.com',
          uid: 'user123',
          name: 'Jane Doe',
          subscriptionStart,
        },
        userEmailVerified: true,
      });

      expect(screen.getByText('Your Account Details')).toBeVisible();
    });

    it('should display user full name', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          name: 'Jane Doe',
        },
      });

      expect(screen.getByText('Jane Doe')).toBeVisible();
    });

    it('should display account created date', async () => {
      const createdAt = new Date('2024-01-15T12:00:00Z');

      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt,
          email: 'jane@example.com',
          uid: 'user123',
        },
      });

      expect(screen.getByText(/January \d+, 2024/)).toBeVisible();
    });

    it('should display subscription start date', async () => {
      const subscriptionStart = new Date('2024-02-01T12:00:00Z');

      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          subscriptionStart,
        },
      });

      expect(screen.getByText(/February \d+, 2024/)).toBeVisible();
    });

    it('should display user email', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
        },
      });

      expect(screen.getByText('jane@example.com')).toBeVisible();
    });

    it('should display email verified status when verified', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
        },
        userEmailVerified: true,
      });

      expect(screen.getByText('Yes')).toBeVisible();
    });

    it('should show email not verified when user email is not verified', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
        },
        userEmailVerified: false,
      });

      expect(screen.getByText('No')).toBeVisible();
    });

    it('should allow user to sign out', async () => {
      const { user, signOutMock } = await setup({
        isAuthenticated: true,
      });

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
      await user.click(signOutButton);

      expect(signOutMock).toHaveBeenCalledOnce();
    });

    it('should not crash when sign out fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - we're just suppressing console output in tests
      });
      const { user } = await setup({
        isAuthenticated: true,
        signOutShouldFail: true,
      });

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
      await user.click(signOutButton);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Sign out failed:', expect.any(Error));

      consoleErrorSpy.mockRestore();
    });
  });

  describe('welcome name prompt', () => {
    it('should show welcome prompt when member is active with no name and no slug', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
        },
      });

      expect(screen.getByText('Welcome to the Rochester Doula Cooperative!')).toBeVisible();
      expect(
        screen.getByText(/To get started with your membership, please enter your full name/),
      ).toBeVisible();
      expect(screen.getByLabelText('Full Name')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Save Name' })).toBeVisible();
    });

    it('should not show welcome prompt when member has a name', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          name: 'Jane Doe',
        },
      });

      expect(screen.queryByText('Welcome to the Rochester Doula Cooperative!')).toBeNull();
    });

    it('should not show welcome prompt when membership is not active', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: false,
        },
      });

      expect(screen.queryByText('Welcome to the Rochester Doula Cooperative!')).toBeNull();
    });

    it('should not show welcome prompt when member already has a slug', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          slug: 'jane-doe',
        },
      });

      expect(screen.queryByText('Welcome to the Rochester Doula Cooperative!')).toBeNull();
    });

    it('should disable save button when name input is empty', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
        },
      });

      const saveButton = screen.getByRole('button', { name: 'Save Name' });
      expect(saveButton).toBeDisabled();
    });

    it('should keep save button disabled when name is only whitespace', async () => {
      const { user } = await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
        },
      });

      const nameInput = screen.getByLabelText('Full Name');
      await user.type(nameInput, '   ');

      const saveButton = screen.getByRole('button', { name: 'Save Name' });
      expect(saveButton).toBeDisabled();
    });

    it('should enable save button when name is entered', async () => {
      const { user } = await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
        },
      });

      const nameInput = screen.getByLabelText('Full Name');
      await user.type(nameInput, 'Jane Doe');

      const saveButton = screen.getByRole('button', { name: 'Save Name' });
      expect(saveButton).toBeEnabled();
    });

    it('should call updateMemberName when save is clicked', async () => {
      const { user, updateMemberNameMock } = await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
        },
      });

      const nameInput = screen.getByLabelText('Full Name');
      await user.type(nameInput, 'Jane Doe');

      const saveButton = screen.getByRole('button', { name: 'Save Name' });
      await user.click(saveButton);

      expect(updateMemberNameMock).toHaveBeenCalledWith('Jane Doe');
    });

    it('should trim whitespace from name before sending to service', async () => {
      const { user, updateMemberNameMock } = await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
        },
      });

      const nameInput = screen.getByLabelText('Full Name');
      await user.type(nameInput, '  Jane Doe  ');

      const saveButton = screen.getByRole('button', { name: 'Save Name' });
      await user.click(saveButton);

      expect(updateMemberNameMock).toHaveBeenCalledWith('Jane Doe');
    });

    it('should show error message when name update fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - we're just suppressing console output in tests
      });

      const { user } = await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
        },
        updateMemberNameShouldFail: true,
      });

      const nameInput = screen.getByLabelText('Full Name');
      await user.type(nameInput, 'Jane Doe');

      const saveButton = screen.getByRole('button', { name: 'Save Name' });
      await user.click(saveButton);

      expect(screen.getByText('Failed to save name')).toBeVisible();

      consoleErrorSpy.mockRestore();
    });

    it('should not show create profile banner when name is missing', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
        },
      });

      expect(screen.queryByText('Create Your Doula Profile')).toBeNull();
    });
  });

  describe('claimable profile banner', () => {
    it('should show error message when claimable profile fails to load', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileError: new Error('Failed to load profile'),
      });

      expect(await screen.findByText('Unable to Load Profile Information')).toBeVisible();
      expect(
        screen.getByText(/We encountered an error while loading your profile information/),
      ).toBeVisible();
    });

    it('should not show claim banner when no claimable profile exists', async () => {
      await setup({
        isAuthenticated: true,
      });

      expect(screen.queryByText('Claim Your Existing Membership')).toBeNull();
    });

    it('should show claim banner when claimable profile exists', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-15T12:00:00Z'),
        },
      });

      expect(await screen.findByText('Claim Your Existing Membership')).toBeVisible();
    });

    it('should show claimable profile name', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-15T12:00:00Z'),
        },
      });

      expect(await screen.findByText('Jane Smith')).toBeVisible();
    });

    it('should show claimable profile subscription start date', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-15T12:00:00Z'),
        },
      });

      expect(await screen.findByText(/June 2023/)).toBeVisible();
    });

    it('should show doula profile message when claimable profile has a profile', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          slug: 'jane-smith',
        },
      });

      expect(
        await screen.findByText(
          /We found an existing doula profile associated with your email address/,
        ),
      ).toBeVisible();
    });

    it('should show membership subscription message when claimable profile has no profile', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
        },
      });

      expect(
        await screen.findByText(
          /We found an existing membership subscription associated with your email address/,
        ),
      ).toBeVisible();
    });

    it('should allow user to claim profile', async () => {
      const { user, claimProfileMock } = await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          slug: 'jane-smith',
        },
      });

      expect(await screen.findByRole('button', { name: 'Claim Membership' })).toBeVisible();

      const claimButton = screen.getByRole('button', { name: 'Claim Membership' });
      await user.click(claimButton);

      expect(claimProfileMock).toHaveBeenCalledOnce();
    });

    it('should hide claim banner after successfully claiming profile', async () => {
      const { user } = await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          slug: 'jane-smith',
        },
      });

      expect(await screen.findByRole('button', { name: 'Claim Membership' })).toBeVisible();

      const claimButton = screen.getByRole('button', { name: 'Claim Membership' });
      await user.click(claimButton);

      expect(screen.queryByText('Claim Your Existing Membership')).toBeNull();
    });

    it('should not crash when claim profile fails', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - we're just suppressing console output in tests
      });
      const { user } = await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          slug: 'jane-smith',
        },
        claimProfileShouldFail: true,
      });

      expect(await screen.findByRole('button', { name: 'Claim Membership' })).toBeVisible();

      const claimButton = screen.getByRole('button', { name: 'Claim Membership' });
      await user.click(claimButton);

      expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to claim profile:', expect.any(Error));

      // Banner should still be visible after error
      expect(screen.getByText('Claim Your Existing Membership')).toBeVisible();

      consoleErrorSpy.mockRestore();
    });
  });
});

interface SetupOptions {
  isAuthenticated?: boolean;
  userDisplayName?: string;
  userEmail?: string;
  userEmailVerified?: boolean;
  hasUserDocument?: boolean;
  userDocument?: Partial<Member>;
  claimableProfileData?: UnclaimedProfile;
  claimableProfileError?: Error;
  signOutShouldFail?: boolean;
  claimProfileShouldFail?: boolean;
  claimProfileError?: Error;
  updateMemberNameShouldFail?: boolean;
}

async function setup({
  isAuthenticated = false,
  userDisplayName,
  userEmail,
  userEmailVerified = false,
  hasUserDocument = true,
  userDocument,
  claimableProfileData,
  claimableProfileError,
  signOutShouldFail = false,
  claimProfileShouldFail = false,
  claimProfileError = new Error('Claim failed'),
  updateMemberNameShouldFail = false,
}: SetupOptions = {}) {
  const mockUser = isAuthenticated
    ? {
        displayName: userDisplayName,
        email: userEmail,
        emailVerified: userEmailVerified,
      }
    : undefined;

  // Create sign out mock based on whether it should fail
  const signOutMock = signOutShouldFail
    ? vi.fn().mockRejectedValue(new Error('Sign out failed'))
    : vi.fn().mockResolvedValue(undefined);

  const mockAuthService = {
    user: signal(mockUser),
    signOut: signOutMock,
  };

  const mockUserDocument = hasUserDocument
    ? {
        createdAt: new Date(),
        email: userEmail ?? 'test@example.com',
        uid: 'test-uid',
        ...userDocument,
      }
    : undefined;

  const getClaimableProfileDataMock = claimableProfileError
    ? vi.fn().mockRejectedValue(claimableProfileError)
    : vi.fn().mockResolvedValue(claimableProfileData);

  // Create claim profile mock based on whether it should fail
  const claimProfileMock = claimProfileShouldFail
    ? vi.fn(() => Promise.reject(claimProfileError))
    : vi.fn(() => Promise.resolve());

  const updateMemberNameMock = updateMemberNameShouldFail
    ? vi.fn().mockRejectedValue(new Error('Failed to save name'))
    : vi.fn().mockResolvedValue(undefined);

  const mockMembershipService = {
    userDocument: signal(mockUserDocument),
    getClaimableProfileData: getClaimableProfileDataMock,
    reloadUserDocument: vi.fn(),
    claimProfile: claimProfileMock,
    updateMemberName: updateMemberNameMock,
  };

  await render(Membership, {
    providers: [
      {
        provide: AuthService,
        useValue: mockAuthService,
      },
      {
        provide: MembershipService,
        useValue: mockMembershipService,
      },
    ],
  });

  // Create userEvent AFTER render so document is available
  const user = userEvent.setup();

  return {
    user,
    claimProfileMock,
    signOutMock,
    updateMemberNameMock,
  };
}
