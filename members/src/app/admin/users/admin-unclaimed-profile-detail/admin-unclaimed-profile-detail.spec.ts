import { computed, signal } from '@angular/core';
import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Timestamp } from '../../../../test-utils/timestamp-mock';
import type { UnclaimedProfile } from '../../admin.types';
import { AdminMembersService } from '../../services/admin-members.service';
import { AdminUnclaimedProfileDetail } from './admin-unclaimed-profile-detail';
import { AdminUnclaimedProfileDetailService } from './admin-unclaimed-profile-detail.service';

describe('AdminUnclaimedProfileDetail', () => {
  // Wait for resource() operations to complete before test cleanup
  // resource.reload() needs time to settle in CI environment
  afterEach(async () => {
    await new Promise((resolve) => setTimeout(resolve, 100));
  });
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

    // Assert - invitation actions are disabled while work is in progress
    // Manual attach stays unavailable here because its UID field starts empty.
    expect(screen.getAllByRole('button', { name: 'Processing...' }).length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Paid Member UID')).toBeDisabled();

    // Clean up - resolve the promise with proper response
    resolveSendInvitationPromise({ success: true });
  });

  it('should disable attach button when member UID is empty', async () => {
    // Arrange & Act
    await setup();

    // Assert
    expect(await screen.findByRole('button', { name: 'Attach to Paid Member' })).toBeDisabled();
  });

  it('should show success message and navigate after successful attach', async () => {
    // Arrange
    const { user, component, router } = await setup();
    const instance = component.fixture.componentInstance as unknown as {
      attachImportedProfile(): Promise<void>;
    };

    // Act
    await user.type(await screen.findByLabelText('Paid Member UID'), 'paid-member-123');
    await instance.attachImportedProfile();

    // Assert
    expect(await screen.findByText('Imported profile attached to member paid-member-123')).toBeVisible();
    expect(router.navigate).toHaveBeenCalledWith(['/admin/members', 'paid-member-123']);
  });

  it('should show error message and not navigate when attach fails', async () => {
    // Arrange
    const { user, component, router } = await setup({ shouldFailAttachImportedProfile: true });
    const instance = component.fixture.componentInstance as unknown as {
      attachImportedProfile(): Promise<void>;
    };

    // Act
    await user.type(await screen.findByLabelText('Paid Member UID'), 'paid-member-123');
    await instance.attachImportedProfile();

    // Assert
    expect(await screen.findByText('Failed to attach imported profile.')).toBeVisible();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should show processing state while attaching imported profile', async () => {
    // Arrange
    const { user, resolveAttachImportedProfilePromise } = await setup({
      shouldKeepAttachingImportedProfile: true,
    });

    // Act
    await user.type(await screen.findByLabelText('Paid Member UID'), 'paid-member-123');
    await user.click(screen.getByRole('button', { name: 'Attach to Paid Member' }));

    // Assert
    expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
    expect(screen.getByLabelText('Paid Member UID')).toBeDisabled();

    // Clean up
    resolveAttachImportedProfilePromise('paid-member-123');
  });

  it('should show Change Email button when invitation already sent', async () => {
    // Arrange & Act
    await setup({ invitationEmailStatus: 'sent' });

    // Assert
    const button = await screen.findByRole('button', {
      name: 'Change Email & Resend Invitation',
    });
    expect(button).toBeVisible();
  });

  it('should not show Change Email button when invitation not sent', async () => {
    // Arrange & Act
    await setup();

    // Assert
    await screen.findByRole('button', { name: 'Send Invitation' });
    expect(
      screen.queryByRole('button', { name: 'Change Email & Resend Invitation' }),
    ).not.toBeInTheDocument();
  });

  it('should show email input form when Change Email button clicked', async () => {
    // Arrange
    const { user } = await setup({ invitationEmailStatus: 'sent' });

    const changeButton = await screen.findByRole('button', {
      name: 'Change Email & Resend Invitation',
    });

    // Act
    await user.click(changeButton);

    // Assert
    expect(screen.getByLabelText('New Email Address')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirm Change & Resend' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  it('should hide form when Cancel clicked', async () => {
    // Arrange
    const { user } = await setup({ invitationEmailStatus: 'sent' });

    const changeButton = await screen.findByRole('button', {
      name: 'Change Email & Resend Invitation',
    });
    await user.click(changeButton);
    expect(screen.getByLabelText('New Email Address')).toBeVisible();

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByLabelText('New Email Address')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Change Email & Resend Invitation' })).toBeVisible();
  });

  it('should disable Confirm button when email input is empty', async () => {
    // Arrange
    const { user } = await setup({ invitationEmailStatus: 'sent' });

    const changeButton = await screen.findByRole('button', {
      name: 'Change Email & Resend Invitation',
    });

    // Act
    await user.click(changeButton);

    // Assert
    expect(screen.getByRole('button', { name: 'Confirm Change & Resend' })).toBeDisabled();
  });

  it('should navigate to new email route after successful change', async () => {
    // Arrange
    const { component, router, mockService } = await setup({ invitationEmailStatus: 'sent' });
    mockService.changeEmailAndResend.mockResolvedValue('new@example.com');

    const instance = component.fixture.componentInstance as unknown as {
      newEmailValue: { set(value: string): void };
      changeEmailAndResend(): Promise<void>;
    };
    instance.newEmailValue.set('new@example.com');

    // Act
    await instance.changeEmailAndResend();

    // Assert
    expect(router.navigate).toHaveBeenCalledWith(['/admin/unclaimed', 'new@example.com']);
  });

  it('should not navigate when change email fails', async () => {
    // Arrange
    const { component, router } = await setup({
      invitationEmailStatus: 'sent',
      shouldFailChangeEmail: true,
    });

    const instance = component.fixture.componentInstance as unknown as {
      newEmailValue: { set(value: string): void };
      changeEmailAndResend(): Promise<void>;
    };
    instance.newEmailValue.set('new@example.com');

    // Act
    await instance.changeEmailAndResend();

    // Assert
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it('should show Update Email button when invitation not sent', async () => {
    // Arrange & Act
    await setup();

    // Assert
    const button = await screen.findByRole('button', { name: 'Update Email' });
    expect(button).toBeVisible();
  });

  it('should not show Update Email button when invitation already sent', async () => {
    // Arrange & Act
    await setup({ invitationEmailStatus: 'sent' });

    // Assert
    await screen.findByRole('button', { name: 'Invitation Already Sent' });
    expect(screen.queryByRole('button', { name: 'Update Email' })).not.toBeInTheDocument();
  });

  it('should show update email form when Update Email button clicked', async () => {
    // Arrange
    const { user } = await setup();

    const updateButton = await screen.findByRole('button', { name: 'Update Email' });

    // Act
    await user.click(updateButton);

    // Assert
    expect(screen.getByLabelText('New Email Address')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Confirm Update' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeVisible();
  });

  it('should hide update email form when Cancel clicked', async () => {
    // Arrange
    const { user } = await setup();

    const updateButton = await screen.findByRole('button', { name: 'Update Email' });
    await user.click(updateButton);
    expect(screen.getByLabelText('New Email Address')).toBeVisible();

    // Act
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    // Assert
    expect(screen.queryByLabelText('New Email Address')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Update Email' })).toBeVisible();
  });

  it('should disable Confirm Update button when email input is empty', async () => {
    // Arrange
    const { user } = await setup();

    const updateButton = await screen.findByRole('button', { name: 'Update Email' });

    // Act
    await user.click(updateButton);

    // Assert
    expect(screen.getByRole('button', { name: 'Confirm Update' })).toBeDisabled();
  });

  it('should navigate to new email route after successful update email', async () => {
    // Arrange
    const { component, router, mockService } = await setup();
    mockService.updateEmail.mockResolvedValue('updated@example.com');

    const instance = component.fixture.componentInstance as unknown as {
      updateEmailValue: { set(value: string): void };
      updateEmail(): Promise<void>;
    };
    instance.updateEmailValue.set('updated@example.com');

    // Act
    await instance.updateEmail();

    // Assert
    expect(router.navigate).toHaveBeenCalledWith(['/admin/unclaimed', 'updated@example.com']);
  });

  it('should not navigate when update email fails', async () => {
    // Arrange
    const { component, router } = await setup({ shouldFailUpdateEmail: true });

    const instance = component.fixture.componentInstance as unknown as {
      updateEmailValue: { set(value: string): void };
      updateEmail(): Promise<void>;
    };
    instance.updateEmailValue.set('updated@example.com');

    // Act
    await instance.updateEmail();

    // Assert
    expect(router.navigate).not.toHaveBeenCalled();
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
  shouldFailChangeEmail?: boolean;
  shouldFailUpdateEmail?: boolean;
  shouldFailAttachImportedProfile?: boolean;
  shouldKeepLoading?: boolean;
  shouldKeepSendingInvitation?: boolean;
  shouldKeepAttachingImportedProfile?: boolean;
  errorMessage?: string;
}

function createMockUnclaimedProfile(overrides: Partial<UnclaimedProfile> = {}): UnclaimedProfile {
  return {
    email: 'test@example.com',
    name: 'Test User',
    slug: 'test-user',
    subscriptionStart: Timestamp.fromDate(new Date('2024-01-01')),
    lastPayment: Timestamp.fromDate(new Date('2024-01-10')),
    nextPayment: Timestamp.fromDate(new Date('2024-02-10')),
    invitationEmailStatus: 'pending',
    ...overrides,
  };
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
    shouldFailChangeEmail = false,
    shouldFailUpdateEmail = false,
    shouldFailAttachImportedProfile = false,
    shouldKeepLoading = false,
    shouldKeepSendingInvitation = false,
    shouldKeepAttachingImportedProfile = false,
    errorMessage = 'Failed to load unclaimed profile details. Please try again.',
  } = options;

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

  let resolveProfilePromise!: (value: UnclaimedProfile) => void;
  const pendingProfilePromise = new Promise<UnclaimedProfile>((resolve) => {
    resolveProfilePromise = resolve;
  });

  let resolveSendInvitationPromise!: (value: { success: boolean; warning?: string }) => void;
  const pendingSendInvitationPromise = new Promise<{ success: boolean; warning?: string }>(
    (resolve) => {
      resolveSendInvitationPromise = resolve;
    },
  );

  let resolveAttachImportedProfilePromise!: (value: string | undefined) => void;
  const pendingAttachImportedProfilePromise = new Promise<string | undefined>((resolve) => {
    resolveAttachImportedProfilePromise = resolve;
  });

  let getProfileCallCount = 0;
  const mockAdminMembersService = {
    getUnclaimedProfile: vi.fn().mockImplementation(() => {
      getProfileCallCount++;
      if (shouldKeepLoading) {
        return pendingProfilePromise;
      }
      if (shouldFailLoad && getProfileCallCount === 1) {
        return Promise.reject(new Error(errorMessage));
      }
      return Promise.resolve(finalProfile);
    }),
    sendInvitation: vi.fn().mockResolvedValue({ success: true }),
    changeEmailAndResend: vi.fn().mockResolvedValue({ success: true }),
    updateEmail: vi.fn().mockResolvedValue({ success: true }),
  };

  const mockService = {
    unclaimedProfileResource: {
      isLoading: vi.fn(() => shouldKeepLoading),
      hasValue: vi.fn(() => !shouldKeepLoading && !shouldFailLoad),
      value: vi.fn(() => finalProfile),
      error: vi.fn(() => (shouldFailLoad ? new Error(errorMessage) : undefined)),
      reload: vi.fn(),
    },
    errorMessage: computed(() => (shouldFailLoad ? errorMessage : undefined)),
    actionInProgress: signal(false),
    successMessage: signal<string | undefined>(undefined),
    actionError: signal<string | undefined>(undefined),
    attachMemberUid: signal(''),
    init: vi.fn(),
    sendInvitation: vi.fn().mockImplementation(async () => {
      mockService.actionInProgress.set(true);
      if (shouldKeepSendingInvitation) {
        return pendingSendInvitationPromise.finally(() => {
          mockService.actionInProgress.set(false);
        });
      }
      if (shouldFailSendInvitation) {
        mockService.actionInProgress.set(false);
        throw new Error('Failed');
      }
      mockService.successMessage.set('Invitation sent successfully');
      mockService.actionInProgress.set(false);
    }),
    attachImportedProfile: vi.fn().mockImplementation(async () => {
      mockService.actionInProgress.set(true);
      const memberUid = mockService.attachMemberUid().trim();
      if (memberUid.length === 0) {
        mockService.actionError.set('Enter a member UID to attach this imported profile.');
        mockService.actionInProgress.set(false);
        return;
      }
      if (shouldKeepAttachingImportedProfile) {
        return pendingAttachImportedProfilePromise.finally(() => {
          mockService.actionInProgress.set(false);
        });
      }
      if (shouldFailAttachImportedProfile) {
        mockService.actionError.set('Failed to attach imported profile.');
        mockService.actionInProgress.set(false);
        return;
      }
      mockService.successMessage.set(`Imported profile attached to member ${memberUid}`);
      mockService.actionInProgress.set(false);
      return memberUid;
    }),
    changeEmailAndResend: vi
      .fn()
      .mockImplementation(async (_oldEmail: string, newEmail: string) => {
        if (shouldFailChangeEmail) {
          mockService.actionError.set('Failed to change email and resend invitation.');
          return;
        }
        mockService.successMessage.set(
          `Email changed to ${newEmail} and invitation resent successfully`,
        );
        return newEmail;
      }),
    updateEmail: vi.fn().mockImplementation(async (_oldEmail: string, newEmail: string) => {
      if (shouldFailUpdateEmail) {
        mockService.actionError.set('Failed to update email.');
        return;
      }
      mockService.successMessage.set(`Email updated to ${newEmail}`);
      return newEmail;
    }),
    deleteInProgress: signal(false),
    deleteProfile: vi.fn().mockResolvedValue(undefined),
  };

  const router = { navigate: vi.fn().mockResolvedValue(true) };

  const component = await render(AdminUnclaimedProfileDetail, {
    providers: [
      provideRouter([]),
      { provide: Router, useValue: router },
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      { provide: AdminUnclaimedProfileDetailService, useValue: mockService },
    ],
    inputs: { email },
  });

  const user = userEvent.setup();

  return {
    user,
    component,
    resolveProfilePromise,
    resolveSendInvitationPromise,
    resolveAttachImportedProfilePromise,
    mockAdminMembersService,
    mockService,
    router,
  };
}
