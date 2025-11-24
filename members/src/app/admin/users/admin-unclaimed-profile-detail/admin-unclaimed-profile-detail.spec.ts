import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { Timestamp } from '../../../../test-utils/timestamp-mock';
import { AdminMembersService } from '../../services/admin-members.service';
import type { UnclaimedProfile } from '../../admin.types';
import { AdminUnclaimedProfileDetail } from './admin-unclaimed-profile-detail';
import { AdminUnclaimedProfileDetailService } from './admin-unclaimed-profile-detail.service';

describe('AdminUnclaimedProfileDetail', () => {
  it('should display loading state initially', async () => {
    // Arrange & Act
    const { resolveProfilePromise } = await setup({ shouldKeepLoading: true });

    // Assert - loading state should be visible
    expect(await screen.findByText('Loading details...')).toBeVisible();

    // Clean up - resolve the promise to avoid hanging test
    resolveProfilePromise(createMockUnclaimedProfile());
  });

  it('should display unclaimed profile information', async () => {
    // Arrange
    const profile = createMockUnclaimedProfile({
      name: 'Jane Doula',
      email: 'jane@example.com',
    });

    // Act
    await setup({ profile });

    // Assert
    expect(await screen.findByText('Jane Doula')).toBeVisible();
    expect(screen.getByText('jane@example.com')).toBeVisible();
  });

  it('should display profile link when slug exists', async () => {
    // Arrange
    const profile = createMockUnclaimedProfile({ slug: 'jane-doula' });

    // Act
    await setup({ profile });

    // Assert
    const link = await screen.findByRole('link', { name: 'View Profile' });
    expect(link).toBeVisible();
    expect(link).toHaveAttribute('href', 'https://doulacooperative.com/doulas/jane-doula');
  });

  it('should display "No" badge when no slug exists', async () => {
    // Arrange & Act
    await setup({ slug: undefined });

    // Assert
    expect(await screen.findByText('No')).toBeVisible();
  });

  it('should display subscription dates', async () => {
    // Arrange
    const profile = createMockUnclaimedProfile({
      subscriptionStart: Timestamp.fromDate(new Date('2024-01-15T12:00:00')),
      lastPayment: Timestamp.fromDate(new Date('2024-02-15T12:00:00')),
      nextPayment: Timestamp.fromDate(new Date('2024-03-15T12:00:00')),
    });

    // Act
    await setup({ profile });

    // Assert
    expect(await screen.findByText(/Jan 15, 2024/)).toBeVisible();
    expect(screen.getByText(/Feb 15, 2024/)).toBeVisible();
    expect(screen.getByText(/Mar 15, 2024/)).toBeVisible();
  });

  it('should display dash when payment dates are missing', async () => {
    // Arrange & Act
    await setup({ lastPayment: undefined, nextPayment: undefined });

    // Assert
    const lastPaymentLabel = await screen.findByText('Last Payment:');
    const lastPaymentValue = lastPaymentLabel.nextElementSibling;
    expect(lastPaymentValue).toHaveTextContent('—');

    const nextPaymentLabel = screen.getByText('Next Payment:');
    const nextPaymentValue = nextPaymentLabel.nextElementSibling;
    expect(nextPaymentValue).toHaveTextContent('—');
  });

  it('should display "Not Sent" status when no invitation sent', async () => {
    // Arrange & Act
    await setup(); // Default has invitationEmailStatus: 'pending'

    // Assert
    expect(await screen.findByText('Not Sent')).toBeVisible();
  });

  it('should display "Sent" status with date when invitation sent', async () => {
    // Arrange & Act
    await setup({
      invitationEmailStatus: 'sent',
      invitationEmailSentAt: Timestamp.fromDate(new Date('2024-01-20T10:00:00')),
    });

    // Assert
    expect(await screen.findByText(/Sent.*Jan 20, 2024/)).toBeVisible();
  });

  it('should display "Failed" status with error when invitation failed', async () => {
    // Arrange & Act
    await setup({
      invitationEmailStatus: 'failed',
      invitationEmailError: 'Invalid email address',
    });

    // Assert
    expect(await screen.findByText('Failed')).toBeVisible();
    expect(screen.getByText('Invalid email address')).toBeVisible();
  });

  it('should enable Send Invitation button when invitation not sent', async () => {
    // Arrange & Act
    await setup(); // Default has invitationEmailStatus: 'pending'

    // Assert
    const button = await screen.findByRole('button', { name: 'Send Invitation' });
    expect(button).toBeVisible();
    expect(button).toBeEnabled();
  });

  it('should disable Send Invitation button when invitation already sent', async () => {
    // Arrange & Act
    await setup({ invitationEmailStatus: 'sent' });

    // Assert
    const button = await screen.findByRole('button', { name: 'Invitation Already Sent' });
    expect(button).toBeVisible();
    expect(button).toBeDisabled();
  });

  it('should show success message after sending invitation', async () => {
    // Arrange
    const { user } = await setup(); // Default has invitationEmailStatus: 'pending'

    expect(await screen.findByRole('button', { name: 'Send Invitation' })).toBeVisible();

    // Act
    const sendButton = screen.getByRole('button', { name: 'Send Invitation' });
    await user.click(sendButton);

    // Assert
    expect(await screen.findByText('Invitation sent successfully')).toBeVisible();
  });

  it('should show error message when sending invitation fails', async () => {
    // Suppress console.error during this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    // Arrange
    const { user } = await setup({ shouldFailSendInvitation: true });

    expect(await screen.findByRole('button', { name: 'Send Invitation' })).toBeVisible();

    // Act
    const sendButton = screen.getByRole('button', { name: 'Send Invitation' });
    await user.click(sendButton);

    // Assert
    expect(await screen.findByText('Failed to send invitation.')).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should display error message when loading fails', async () => {
    // Suppress console.error during this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    // Arrange & Act
    await setup({ shouldFailLoad: true });

    // Assert
    expect(
      await screen.findByText('Failed to load unclaimed profile details. Please try again.'),
    ).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should show processing state while sending invitation', async () => {
    // Arrange
    const { user, resolveSendInvitationPromise } = await setup({
      shouldKeepSendingInvitation: true,
    });

    expect(await screen.findByRole('button', { name: 'Send Invitation' })).toBeVisible();

    // Act
    const sendButton = screen.getByRole('button', { name: 'Send Invitation' });
    await user.click(sendButton);

    // Assert - button should show processing state
    expect(await screen.findByRole('button', { name: 'Processing...' })).toBeVisible();

    // Clean up - resolve the promise
    resolveSendInvitationPromise();
  });
});

interface SetupOptions {
  email?: string;
  profile?: UnclaimedProfile;
  slug?: string | undefined;
  invitationEmailStatus?: 'pending' | 'sent' | 'failed';
  invitationEmailSentAt?: typeof Timestamp.prototype;
  invitationEmailError?: string;
  lastPayment?: typeof Timestamp.prototype | undefined;
  nextPayment?: typeof Timestamp.prototype | undefined;
  shouldFailLoad?: boolean;
  shouldFailSendInvitation?: boolean;
  shouldKeepLoading?: boolean;
  shouldKeepSendingInvitation?: boolean;
  errorMessage?: string;
}

async function setup(options: SetupOptions = {}) {
  const {
    email = 'test@example.com',
    profile,
    slug,
    invitationEmailStatus,
    invitationEmailSentAt,
    invitationEmailError,
    lastPayment,
    nextPayment,
    shouldFailLoad = false,
    shouldFailSendInvitation = false,
    shouldKeepLoading = false,
    shouldKeepSendingInvitation = false,
    errorMessage = 'Failed to load unclaimed profile details. Please try again.',
  } = options;

  const user = userEvent.setup();

  // Build the profile with defaults and overrides
  const baseProfile = createMockUnclaimedProfile({ email });
  const finalProfile =
    profile ??
    ({
      ...baseProfile,
      ...('slug' in options ? { slug } : {}),
      ...('invitationEmailStatus' in options ? { invitationEmailStatus } : {}),
      ...('invitationEmailSentAt' in options ? { invitationEmailSentAt } : {}),
      ...('invitationEmailError' in options ? { invitationEmailError } : {}),
      ...('lastPayment' in options ? { lastPayment } : {}),
      ...('nextPayment' in options ? { nextPayment } : {}),
    } as UnclaimedProfile);

  let resolveProfilePromise: (value: UnclaimedProfile) => void;
  const pendingProfilePromise = new Promise<UnclaimedProfile>((resolve) => {
    resolveProfilePromise = resolve;
  });

  let getProfileCallCount = 0;
  const getUnclaimedProfile = vi.fn().mockImplementation(() => {
    getProfileCallCount++;

    if (shouldKeepLoading) {
      return pendingProfilePromise;
    }

    if (shouldFailLoad && getProfileCallCount === 1) {
      return Promise.reject(new Error(errorMessage));
    }

    return Promise.resolve(finalProfile);
  });

  let resolveSendInvitationPromise: () => void;
  const pendingSendInvitationPromise = new Promise<void>((resolve) => {
    resolveSendInvitationPromise = resolve;
  });

  const sendInvitation = vi.fn().mockImplementation(() => {
    if (shouldKeepSendingInvitation) {
      return pendingSendInvitationPromise;
    }

    if (shouldFailSendInvitation) {
      return Promise.reject(new Error('Failed'));
    }

    return Promise.resolve({ success: true });
  });

  const mockAdminMembersService = {
    getUnclaimedProfile,
    sendInvitation,
  };

  const component = await render(AdminUnclaimedProfileDetail, {
    providers: [
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      AdminUnclaimedProfileDetailService, // Provide real service, it will use mocked AdminMembersService
    ],
    inputs: { email },
  });

  return {
    user,
    component,
    resolveProfilePromise: resolveProfilePromise!,
    resolveSendInvitationPromise: resolveSendInvitationPromise!,
    mockAdminMembersService,
  };
}

function createMockUnclaimedProfile(overrides: Partial<UnclaimedProfile> = {}): UnclaimedProfile {
  return {
    email: 'test@example.com',
    name: 'Test User',
    slug: 'test-user',
    subscriptionStart: Timestamp.fromDate(new Date('2024-01-01')),
    invitationEmailStatus: 'pending',
    ...overrides,
  };
}
