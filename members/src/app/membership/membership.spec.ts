import { signal } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { type Member, MembershipService } from '../services/membership.service';
import { Membership } from './membership';
import { FACEBOOK_GROUP_URL } from '../constants/urls';

describe('Membership', () => {
  // Add dialog polyfill for jsdom
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

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
          profileApprovedAt: new Date(),
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
          profileApprovedAt: new Date(),
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
          profileApprovedAt: new Date(),
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
          profileApprovedAt: new Date(),
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
          profileApprovedAt: new Date(),
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
          profileApprovedAt: new Date(),
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
          profileApprovedAt: new Date(),
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

    it('should show welcome prompt when active member name is missing', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          profileApprovedAt: new Date(),
        },
      });

      expect(screen.getByText('Welcome to the Rochester Doula Cooperative!')).toBeVisible();
    });

    it('should show create profile banner when active member has a name', async () => {
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

      expect(screen.getByText('Create Your Doula Profile')).toBeVisible();
      expect(screen.getByText(/active membership\./)).toBeVisible();
    });
  });

  describe('cancel membership', () => {
    it('should show cancel button for active Stripe members', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          subscriptionStatus: 'active',
          lastPayment: new Date(),
        },
      });

      expect(screen.getByRole('button', { name: 'Cancel Membership' })).toBeVisible();
    });

    it('should not show cancel button for members without Stripe subscription ID', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          stripeCustomerId: 'cus_123',
          lastPayment: new Date(),
        },
      });

      expect(screen.queryByRole('button', { name: 'Cancel Membership' })).toBeNull();
    });

    it('should not show cancel button for members without Stripe customer ID', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          lastPayment: new Date(),
        },
      });

      expect(screen.queryByRole('button', { name: 'Cancel Membership' })).toBeNull();
    });

    it('should not show cancel button when subscription is already canceled', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          subscriptionStatus: 'canceled',
          lastPayment: new Date(),
        },
      });

      expect(screen.queryByRole('button', { name: 'Cancel Membership' })).toBeNull();
    });

    it('should not show cancel button when subscription is refunded', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          subscriptionStatus: 'refunded',
          lastPayment: new Date(),
        },
      });

      expect(screen.queryByRole('button', { name: 'Cancel Membership' })).toBeNull();
    });

    it('should not show cancel button when membership is inactive', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: false,
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          subscriptionStatus: 'active',
          lastPayment: new Date(),
        },
      });

      expect(screen.queryByRole('button', { name: 'Cancel Membership' })).toBeNull();
    });

    it('should show cancellation notice when subscription status is canceled', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          subscriptionStatus: 'canceled',
          lastPayment: new Date(),
        },
      });

      expect(
        screen.getByText(
          /Membership cancellation scheduled.*remain an active member until your current billing period ends/,
        ),
      ).toBeVisible();
    });

    it('should call cancelMembership when confirmed', async () => {
      const { user, cancelMembershipMock } = await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: true,
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          subscriptionStatus: 'active',
          lastPayment: new Date(),
        },
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel Membership' });
      await user.click(cancelButton);

      // Confirm in dialog
      const confirmButton = screen.getAllByRole('button', { name: 'Cancel Membership' }).at(-1)!;
      await user.click(confirmButton);

      expect(cancelMembershipMock).toHaveBeenCalledOnce();
    });

    it('should show error message when cancellation fails', async () => {
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
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          subscriptionStatus: 'active',
          lastPayment: new Date(),
        },
        cancelMembershipShouldFail: true,
      });

      const cancelButton = screen.getByRole('button', { name: 'Cancel Membership' });
      await user.click(cancelButton);

      // Confirm in dialog
      const confirmButton = screen.getAllByRole('button', { name: 'Cancel Membership' }).at(-1)!;
      await user.click(confirmButton);

      expect(screen.getByText('Failed to cancel membership')).toBeVisible();

      consoleErrorSpy.mockRestore();
    });
  });

  describe('member community card', () => {
    it('should show Facebook group card when membership is active', async () => {
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

      expect(screen.getByText('Member Community')).toBeVisible();
      expect(
        screen.getByText(
          'Connect with your fellow cooperative members in our private Facebook group.',
        ),
      ).toBeVisible();
      expect(screen.getByRole('link', { name: 'Join the Facebook Group' })).toBeVisible();
    });

    it('should not show Facebook group card when membership is inactive', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: false,
          name: 'Jane Doe',
        },
      });

      expect(screen.queryByText('Member Community')).toBeNull();
    });

    it('should have correct URL, target, and rel attributes on Facebook group link', async () => {
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

      const link = screen.getByRole('link', { name: 'Join the Facebook Group' });
      expect(link).toHaveAttribute('href', FACEBOOK_GROUP_URL);
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('referrals card', () => {
    const activeStripeMember: Partial<Member> = {
      createdAt: new Date(),
      email: 'jane@example.com',
      uid: 'user123',
      membershipActive: true,
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_123',
      subscriptionStatus: 'active',
    };

    it('shows referrals link for active Stripe member', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: activeStripeMember,
      });

      expect(screen.getByRole('link', { name: 'View Referrals' })).toBeVisible();
    });

    it('does not show referrals link for member without Stripe subscription', async () => {
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

      expect(screen.queryByRole('link', { name: 'View Referrals' })).toBeNull();
    });

    it('does not show referrals link for inactive member', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          createdAt: new Date(),
          email: 'jane@example.com',
          uid: 'user123',
          membershipActive: false,
          stripeCustomerId: 'cus_123',
          stripeSubscriptionId: 'sub_123',
          subscriptionStatus: 'canceled',
        },
      });

      expect(screen.queryByRole('link', { name: 'View Referrals' })).toBeNull();
    });

    it('shows referrals link for trialing member', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          ...activeStripeMember,
          subscriptionStatus: 'trialing',
        },
      });

      expect(screen.getByRole('link', { name: 'View Referrals' })).toBeVisible();
    });

    it('does not show referrals link for past_due member', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          ...activeStripeMember,
          subscriptionStatus: 'past_due',
        },
      });

      expect(screen.queryByRole('link', { name: 'View Referrals' })).toBeNull();
    });

    it('does not show referrals link for incomplete member', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          ...activeStripeMember,
          subscriptionStatus: 'incomplete',
        },
      });

      expect(screen.queryByRole('link', { name: 'View Referrals' })).toBeNull();
    });

    it('does not show referrals link for unpaid member', async () => {
      await setup({
        isAuthenticated: true,
        hasUserDocument: true,
        userDocument: {
          ...activeStripeMember,
          subscriptionStatus: 'unpaid',
        },
      });

      expect(screen.queryByRole('link', { name: 'View Referrals' })).toBeNull();
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
  signOutShouldFail?: boolean;
  updateMemberNameShouldFail?: boolean;
  cancelMembershipShouldFail?: boolean;
}

async function setup({
  isAuthenticated = false,
  userDisplayName,
  userEmail,
  userEmailVerified = false,
  hasUserDocument = true,
  userDocument,
  signOutShouldFail = false,
  updateMemberNameShouldFail = false,
  cancelMembershipShouldFail = false,
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

  const updateMemberNameMock = updateMemberNameShouldFail
    ? vi.fn().mockRejectedValue(new Error('Failed to save name'))
    : vi.fn().mockResolvedValue(undefined);

  const updateMemberSlugMock = vi.fn().mockResolvedValue(undefined);
  const checkSlugExistsMock = vi.fn().mockResolvedValue(false);

  const cancelMembershipMock = cancelMembershipShouldFail
    ? vi.fn().mockRejectedValue(new Error('Failed to cancel membership'))
    : vi.fn().mockResolvedValue(undefined);

  const mockMembershipService = {
    userDocument: signal(mockUserDocument),
    reloadUserDocument: vi.fn(),
    updateMemberName: updateMemberNameMock,
    updateMemberSlug: updateMemberSlugMock,
    checkSlugExists: checkSlugExistsMock,
    cancelMembership: cancelMembershipMock,
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
      provideRouter([]),
    ],
  });

  // Create userEvent AFTER render so document is available
  const user = userEvent.setup();

  return {
    user,
    signOutMock,
    updateMemberNameMock,
    updateMemberSlugMock,
    checkSlugExistsMock,
    cancelMembershipMock,
  };
}
