import { signal } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { ClaimableMembershipData, Member, MembershipService } from '../services/membership.service';
import { Membership } from './membership';

describe('Membership', () => {
  describe('unauthenticated state', () => {
    it('should not show any content when user is not authenticated', async () => {
      await setup({ isAuthenticated: false });

      expect(screen.queryByText(/Welcome back/)).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Sign Out' })).not.toBeInTheDocument();
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
      const createdAt = Timestamp.fromDate(new Date('2024-01-15T12:00:00Z'));
      const subscriptionStart = Timestamp.fromDate(new Date('2024-02-01T12:00:00Z'));

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
          createdAt: Timestamp.now(),
          email: 'jane@example.com',
          uid: 'user123',
          name: 'Jane Doe',
        },
      });

      expect(screen.getByText('Jane Doe')).toBeVisible();
    });

    it('should display account created date', async () => {
      const createdAt = Timestamp.fromDate(new Date('2024-01-15T12:00:00Z'));

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
      const subscriptionStart = Timestamp.fromDate(new Date('2024-02-01T12:00:00Z'));

      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: Timestamp.now(),
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
          createdAt: Timestamp.now(),
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
          createdAt: Timestamp.now(),
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
          createdAt: Timestamp.now(),
          email: 'jane@example.com',
          uid: 'user123',
        },
        userEmailVerified: false,
      });

      expect(screen.getByText('No')).toBeVisible();
    });

    it('should allow user to sign out', async () => {
      const signOutMock = vi.fn().mockResolvedValue(undefined);
      const { user } = await setup({
        isAuthenticated: true,
        signOutImplementation: signOutMock,
      });

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
      await user.click(signOutButton);

      await waitFor(() => {
        expect(signOutMock).toHaveBeenCalledOnce();
      });
    });

    it('should not crash when sign out fails', async () => {
      const signOutMock = vi.fn().mockRejectedValue(new Error('Sign out failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - we're just suppressing console output in tests
      });
      const { user } = await setup({
        isAuthenticated: true,
        signOutImplementation: signOutMock,
      });

      const signOutButton = screen.getByRole('button', { name: 'Sign Out' });
      await user.click(signOutButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Sign out failed:', expect.any(Error));
      });

      consoleErrorSpy.mockRestore();
    });
  });

  describe('claimable profile banner', () => {
    it('should not show claim banner when no claimable profile exists', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: undefined,
      });

      // Wait a bit to ensure effect has run
      await waitFor(() => {
        expect(screen.queryByText('Claim Your Existing Membership')).not.toBeInTheDocument();
      });
    });

    it('should show claim banner when claimable profile exists', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-15T12:00:00Z'),
          hasProfile: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Claim Your Existing Membership')).toBeVisible();
      });
    });

    it('should show claimable profile name', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-15T12:00:00Z'),
          hasProfile: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText('Jane Smith')).toBeVisible();
      });
    });

    it('should show claimable profile subscription start date', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-15T12:00:00Z'),
          hasProfile: true,
        },
      });

      await waitFor(() => {
        expect(screen.getByText(/June 2023/)).toBeVisible();
      });
    });

    it('should show doula profile message when claimable profile has a profile', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          hasProfile: true,
        },
      });

      await waitFor(() => {
        expect(
          screen.getByText(/We found an existing doula profile associated with your email address/),
        ).toBeVisible();
      });
    });

    it('should show membership subscription message when claimable profile has no profile', async () => {
      await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          hasProfile: false,
        },
      });

      await waitFor(() => {
        expect(
          screen.getByText(
            /We found an existing membership subscription associated with your email address/,
          ),
        ).toBeVisible();
      });
    });

    it('should allow user to claim profile', async () => {
      const claimProfileMock = vi.fn().mockResolvedValue(undefined);
      const { user } = await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          hasProfile: true,
        },
        claimProfileImplementation: claimProfileMock,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Claim Membership' })).toBeVisible();
      });

      const claimButton = screen.getByRole('button', { name: 'Claim Membership' });
      await user.click(claimButton);

      await waitFor(() => {
        expect(claimProfileMock).toHaveBeenCalledOnce();
      });
    });

    it('should show loading state while claiming profile', async () => {
      let resolveClaimProfile: () => void;
      const claimProfilePromise = new Promise<void>((resolve) => {
        resolveClaimProfile = resolve;
      });
      const claimProfileMock = vi.fn().mockReturnValue(claimProfilePromise);

      const { user } = await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          hasProfile: true,
        },
        claimProfileImplementation: claimProfileMock,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Claim Membership' })).toBeVisible();
      });

      const claimButton = screen.getByRole('button', { name: 'Claim Membership' });
      await user.click(claimButton);

      // Button should show loading state and be disabled
      expect(screen.getByRole('button', { name: 'Claiming Membership...' })).toBeDisabled();

      // Resolve the promise
      resolveClaimProfile!();
      await waitFor(() => {
        expect(claimProfileMock).toHaveBeenCalledOnce();
      });
    });

    it('should hide claim banner after successfully claiming profile', async () => {
      const claimProfileMock = vi.fn().mockResolvedValue(undefined);
      const { user } = await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          hasProfile: true,
        },
        claimProfileImplementation: claimProfileMock,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Claim Membership' })).toBeVisible();
      });

      const claimButton = screen.getByRole('button', { name: 'Claim Membership' });
      await user.click(claimButton);

      await waitFor(() => {
        expect(screen.queryByText('Claim Your Existing Membership')).not.toBeInTheDocument();
      });
    });

    it('should not crash when claim profile fails', async () => {
      const claimProfileMock = vi.fn().mockRejectedValue(new Error('Claim failed'));
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
        // Intentionally empty - we're just suppressing console output in tests
      });
      const { user } = await setup({
        isAuthenticated: true,
        claimableProfileData: {
          name: 'Jane Smith',
          subscriptionStart: new Date('2023-06-01'),
          hasProfile: true,
        },
        claimProfileImplementation: claimProfileMock,
      });

      await waitFor(() => {
        expect(screen.getByRole('button', { name: 'Claim Membership' })).toBeVisible();
      });

      const claimButton = screen.getByRole('button', { name: 'Claim Membership' });
      await user.click(claimButton);

      await waitFor(() => {
        expect(consoleErrorSpy).toHaveBeenCalledWith('Failed to claim profile:', expect.any(Error));
      });

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
  claimableProfileData?: ClaimableMembershipData;
  signOutImplementation?: () => Promise<void>;
  claimProfileImplementation?: () => Promise<void>;
}

async function setup(options: SetupOptions = {}) {
  const {
    isAuthenticated = false,
    userDisplayName,
    userEmail,
    userEmailVerified = false,
    hasUserDocument = true,
    userDocument,
    claimableProfileData,
    signOutImplementation = vi.fn().mockResolvedValue(undefined),
    claimProfileImplementation = vi.fn().mockResolvedValue(undefined),
  } = options;

  const user = userEvent.setup();

  const mockUser = isAuthenticated
    ? {
        displayName: userDisplayName,
        email: userEmail,
        emailVerified: userEmailVerified,
      }
    : undefined;

  const mockAuthService = {
    user: signal(mockUser),
    signOut: signOutImplementation,
    claimProfile: claimProfileImplementation,
  };

  const mockUserDocument = hasUserDocument
    ? {
        createdAt: Timestamp.now(),
        email: userEmail ?? 'test@example.com',
        uid: 'test-uid',
        ...userDocument,
      }
    : undefined;

  const mockMembershipService = {
    userDocument: signal(mockUserDocument),
    getClaimableProfileData: vi.fn().mockResolvedValue(claimableProfileData),
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

  return { user };
}
