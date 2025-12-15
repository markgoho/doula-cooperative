import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AdminMembersService } from '../../services/admin-members.service';
import type { Member } from '../../admin.types';
import { AdminMemberDetail } from './admin-member-detail';
import { AdminMemberDetailService } from './admin-member-detail.service';

describe('AdminUserDetail', () => {
  // Add dialog polyfill for jsdom
  beforeAll(() => {
    HTMLDialogElement.prototype.showModal = vi.fn(function (this: HTMLDialogElement) {
      this.open = true;
    });
    HTMLDialogElement.prototype.close = vi.fn(function (this: HTMLDialogElement) {
      this.open = false;
    });
  });

  it('should display loading state initially', async () => {
    // Arrange & Act
    const { resolveMemberPromise } = await setup({ shouldKeepLoading: true });

    // Assert - loading state should be visible
    expect(await screen.findByText('Loading details...')).toBeVisible();

    // Clean up - resolve the promise to avoid hanging test
    resolveMemberPromise(createMockMember());
  });

  it('should display user account information', async () => {
    // Arrange
    const member = createMockMember({
      name: 'Alice Smith',
      email: 'alice@example.com',
      uid: 'user-123',
    });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByText('Alice Smith')).toBeVisible();
    expect(screen.getByText('alice@example.com')).toBeVisible();
    expect(screen.getByText('user-123')).toBeVisible();
  });

  it('should display dash when user has no name', async () => {
    // Arrange
    const member = createMockMember();
    delete (member as Partial<Member>).name;

    // Act
    await setup({ member });

    // Assert
    const nameLabel = await screen.findByText('Name:');
    const nameValue = nameLabel.parentElement?.querySelector('dd');
    expect(nameValue).toHaveTextContent('—');
  });

  it('should display formatted account creation date', async () => {
    // Arrange
    const member = createMockMember({
      createdAt: '2024-03-15T14:30:00.000Z',
    });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByText(/Mar 15, 2024/)).toBeVisible();
  });

  it('should display active status badge for active members', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: true });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByText('Active')).toBeVisible();
  });

  it('should display inactive status badge for inactive members', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: false });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByText('Inactive')).toBeVisible();
  });

  it('should display subscription dates', async () => {
    // Arrange
    const member = createMockMember({
      createdAt: '2024-01-01T10:30:00.000Z',
      subscriptionStart: '2024-01-15T12:00:00.000Z',
      membershipExpiresAt: '2025-01-15T12:00:00.000Z',
    });

    // Act
    await setup({ member });

    // Assert
    // Check that subscription start date is visible
    const subscriptionLabel = await screen.findByText('Subscription Start:');
    const subscriptionValue = subscriptionLabel.nextElementSibling;
    expect(subscriptionValue).toHaveTextContent(/Jan 15, 2024/);

    // Check that membership expires date is visible
    const expiresLabel = screen.getByText('Membership Expires:');
    const expiresValue = expiresLabel.nextElementSibling;
    expect(expiresValue).toHaveTextContent(/Jan 15, 2025/);
  });

  it('should display dash when subscription dates are missing', async () => {
    // Arrange
    const member = createMockMember();
    delete (member as Partial<Member>).subscriptionStart;
    delete (member as Partial<Member>).membershipExpiresAt;

    // Act
    await setup({ member });

    // Assert
    const subscriptionLabel = await screen.findByText('Subscription Start:');
    const subscriptionValue = subscriptionLabel.parentElement?.querySelector('dd');
    expect(subscriptionValue).toHaveTextContent('—');
  });

  it('should display Stripe information when present', async () => {
    // Arrange
    const member = createMockMember({
      stripeCustomerId: 'cus_123',
      stripeSubscriptionId: 'sub_456',
      subscriptionStatus: 'active',
    });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByText('cus_123')).toBeVisible();
    expect(screen.getByText('sub_456')).toBeVisible();
  });

  it('should not display Stripe section when not a Stripe customer', async () => {
    // Arrange
    const member = createMockMember();
    delete (member as Partial<Member>).stripeCustomerId;

    // Act
    await setup({ member });

    // Assert
    expect(screen.queryByText('Stripe Customer ID:')).toBeNull();
  });

  it('should display Activate button for inactive members', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: false });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByRole('button', { name: 'Activate Membership' })).toBeVisible();
  });

  it('should display Deactivate button for active members', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: true });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByRole('button', { name: 'Deactivate Membership' })).toBeVisible();
  });

  it('should show warning for Stripe-managed subscriptions', async () => {
    // Arrange
    const member = createMockMember({
      stripeCustomerId: 'cus_123',
    });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByText(/This membership is managed by Stripe/)).toBeVisible();
  });

  it('should show success message after activating membership', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: false });
    const { user } = await setup({ member });

    expect(await screen.findByRole('button', { name: 'Activate Membership' })).toBeVisible();

    // Act - Click activate button to open dialog
    const activateButton = screen.getByRole('button', { name: 'Activate Membership' });
    await user.click(activateButton);

    // Click confirm in dialog
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    // Assert
    expect(await screen.findByText('Membership activated successfully')).toBeVisible();
  });

  it('should show error message when activation fails', async () => {
    // Suppress console.error during this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    // Arrange
    const member = createMockMember({ membershipActive: false });
    const { user } = await setup({ member, shouldFailActivate: true });

    expect(await screen.findByRole('button', { name: 'Activate Membership' })).toBeVisible();

    // Act - Click activate button to open dialog
    const activateButton = screen.getByRole('button', { name: 'Activate Membership' });
    await user.click(activateButton);

    // Click confirm in dialog
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    // Assert
    expect(await screen.findByText('Failed to activate membership.')).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should not activate when user cancels confirmation', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: false });
    const { user } = await setup({ member });

    expect(await screen.findByRole('button', { name: 'Activate Membership' })).toBeVisible();

    // Act - Click activate button to open dialog
    const activateButton = screen.getByRole('button', { name: 'Activate Membership' });
    await user.click(activateButton);

    // Click cancel in dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    // Assert - Success message should not appear
    expect(screen.queryByText('Membership activated successfully')).toBeNull();
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
      await screen.findByText('Failed to load member details. Please try again.'),
    ).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should display delete button for non-admin users', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: false });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByRole('button', { name: 'Delete User Account' })).toBeVisible();
    expect(screen.getByText('Danger Zone')).toBeVisible();
  });

  it('should hide delete button and show message for admin users', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: true });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByText('Admin Account')).toBeVisible();
    expect(
      screen.getByText(/This user has admin privileges. Admin accounts cannot be deleted./),
    ).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Delete User Account' })).toBeNull();
  });

  it.skip('should call deleteUser service after confirmation', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: false });
    const { user, mockAdminMembersService } = await setup({ member });

    expect(await screen.findByRole('button', { name: 'Delete User Account' })).toBeVisible();

    // Act - Click delete button to open dialog
    const deleteButton = screen.getByRole('button', { name: 'Delete User Account' });
    await user.click(deleteButton);

    // Verify confirmation message
    expect(
      screen.getByText(/Are you sure you want to permanently delete this user account/),
    ).toBeVisible();

    // Click confirm in dialog
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    // Assert - deleteUser service method should have been called
    await new Promise((resolve) => setTimeout(resolve, 100)); // Give time for async operation
    expect(mockAdminMembersService.deleteUser).toHaveBeenCalledWith('test-uid-123');
  });

  it('should show error message when deletion fails', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: false });
    const { user } = await setup({ member, shouldFailDelete: true });

    expect(await screen.findByRole('button', { name: 'Delete User Account' })).toBeVisible();

    // Act - Click delete button to open dialog
    const deleteButton = screen.getByRole('button', { name: 'Delete User Account' });
    await user.click(deleteButton);

    // Click confirm in dialog
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    // Assert
    expect(await screen.findByText('Failed to delete user.')).toBeVisible();
  });

  it('should not delete when user cancels confirmation', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: false });
    const { user } = await setup({ member });

    expect(await screen.findByRole('button', { name: 'Delete User Account' })).toBeVisible();

    // Act - Click delete button to open dialog
    const deleteButton = screen.getByRole('button', { name: 'Delete User Account' });
    await user.click(deleteButton);

    // Click cancel in dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    // Assert - Error/success message should not appear
    expect(screen.queryByText(/Failed to delete user/)).toBeNull();
    expect(screen.queryByText('User deleted successfully')).toBeNull();
  });

  it('should show danger zone with warning for non-admin users', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: false });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByText('Danger Zone')).toBeVisible();
    expect(
      screen.getByText(
        /This action is irreversible. Deleting this user will permanently remove their account/,
      ),
    ).toBeVisible();
  });
});

interface SetupOptions {
  uid?: string;
  member?: Member;
  shouldFailLoad?: boolean;
  shouldFailActivate?: boolean;
  shouldFailDeactivate?: boolean;
  shouldFailDelete?: boolean;
  shouldKeepLoading?: boolean;
  errorMessage?: string;
}

async function setup({
  uid = 'test-uid-123',
  member,
  shouldFailLoad = false,
  shouldFailActivate = false,
  shouldFailDeactivate = false,
  shouldFailDelete = false,
  shouldKeepLoading = false,
  errorMessage = 'Failed to load member details. Please try again.',
}: SetupOptions = {}) {
  const defaultMember = createMockMember({ uid });
  const memberToUse = member ?? defaultMember;

  let resolveMemberPromise: (value: Member) => void;
  const pendingMemberPromise = new Promise<Member>((resolve) => {
    resolveMemberPromise = resolve;
  });

  const mockAdminMembersService = {
    getMember: vi.fn().mockImplementation(() => {
      if (shouldKeepLoading) {
        return pendingMemberPromise;
      }

      if (shouldFailLoad) {
        return Promise.reject(new Error(errorMessage));
      }

      return Promise.resolve(memberToUse);
    }),
    activateMembership: shouldFailActivate
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({ success: true }),
    deactivateMembership: shouldFailDeactivate
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({ success: true }),
    deleteUser: shouldFailDelete
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({ success: true }),
    readMemberProfile: vi.fn().mockResolvedValue({
      content: 'Mock profile content',
      image: 'https://example.com/image.jpg',
      slug: 'test-slug',
    }),
  };

  const component = await render(AdminMemberDetail, {
    providers: [
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      AdminMemberDetailService, // Provide real service, it will use mocked AdminMembersService
    ],
    inputs: { uid },
  });

  // IMPORTANT: Call userEvent.setup() AFTER render() to avoid ApplicationRef destroyed warnings
  const user = userEvent.setup();

  return {
    user,
    component,
    resolveMemberPromise: resolveMemberPromise!,
    mockAdminMembersService,
  };
}

function createMockMember(overrides: Partial<Member> = {}): Member {
  return {
    uid: 'test-uid-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2024-01-15T10:30:00.000Z',
    membershipActive: false,
    subscriptionStart: '2024-01-01T00:00:00.000Z',
    membershipExpiresAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}
