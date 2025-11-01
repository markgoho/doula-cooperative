import { Timestamp } from '@angular/fire/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import { AdminMembersService, type Member } from '../admin.service';
import { AdminUserDetail } from './admin-user-detail';

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
  interface SetupOptions {
    uid?: string;
    member?: Member;
    shouldFailLoad?: boolean;
    shouldFailActivate?: boolean;
    shouldFailDeactivate?: boolean;
    shouldKeepLoading?: boolean;
    errorMessage?: string;
  }

  async function setup({
    uid = 'test-uid-123',
    member,
    shouldFailLoad = false,
    shouldFailActivate = false,
    shouldFailDeactivate = false,
    shouldKeepLoading = false,
    errorMessage = 'Failed to load member details. Please try again.',
  }: SetupOptions = {}) {
    const user = userEvent.setup();

    const defaultMember = createMockMember({ uid });
    const memberToUse = member ?? defaultMember;

    let resolveMemberPromise: (value: Member) => void;
    const pendingMemberPromise = new Promise<Member>((resolve) => {
      resolveMemberPromise = resolve;
    });

    let getMemberCallCount = 0;
    const mockAdminMembersService = {
      getMember: vi.fn().mockImplementation(() => {
        getMemberCallCount++;

        if (shouldKeepLoading) {
          return pendingMemberPromise;
        }

        if (shouldFailLoad && getMemberCallCount === 1) {
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
    };

    const component = await render(AdminUserDetail, {
      providers: [{ provide: AdminMembersService, useValue: mockAdminMembersService }],
      componentInputs: { uid },
    });

    return { user, component, resolveMemberPromise: resolveMemberPromise! };
  }

  function createMockMember(overrides: Partial<Member> = {}): Member {
    return {
      uid: 'test-uid-123',
      email: 'test@example.com',
      name: 'Test User',
      createdAt: Timestamp.fromDate(new Date('2024-01-15T10:30:00')),
      membershipActive: false,
      subscriptionStart: Timestamp.fromDate(new Date('2024-01-01')),
      membershipExpiresAt: Timestamp.fromDate(new Date('2025-01-01')),
      hasProfile: false,
      ...overrides,
    };
  }

  it.skip('should display loading state initially', async () => {
    // Arrange & Act
    const { resolveMemberPromise } = await setup({ shouldKeepLoading: true });

    // Assert - loading state should be visible
    expect(screen.getByText('Loading user details...')).toBeVisible();

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
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeVisible();
      expect(screen.getByText('alice@example.com')).toBeVisible();
      expect(screen.getByText('user-123')).toBeVisible();
    });
  });

  it('should display dash when user has no name', async () => {
    // Arrange
    const member = createMockMember({ name: undefined });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      const nameLabel = screen.getByText('Name:');
      const nameValue = nameLabel.parentElement?.querySelector('dd');
      expect(nameValue).toHaveTextContent('—');
    });
  });

  it('should display formatted account creation date', async () => {
    // Arrange
    const member = createMockMember({
      createdAt: Timestamp.fromDate(new Date('2024-03-15T14:30:00')),
    });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Mar 15, 2024/)).toBeVisible();
    });
  });

  it('should display active status badge for active members', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: true });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      const badge = screen.getByText('Active');
      expect(badge).toBeVisible();
      expect(badge).toHaveClass('active');
    });
  });

  it('should display inactive status badge for inactive members', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: false });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      const badge = screen.getByText('Inactive');
      expect(badge).toBeVisible();
      expect(badge).toHaveClass('inactive');
    });
  });

  it('should display subscription dates', async () => {
    // Arrange
    const member = createMockMember({
      createdAt: Timestamp.fromDate(new Date('2024-01-01T10:30:00')),
      subscriptionStart: Timestamp.fromDate(new Date('2024-01-15T12:00:00')),
      membershipExpiresAt: Timestamp.fromDate(new Date('2025-01-15T12:00:00')),
    });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      // Check that subscription start date is visible
      const subscriptionLabel = screen.getByText('Subscription Start:');
      const subscriptionValue = subscriptionLabel.nextElementSibling;
      expect(subscriptionValue).toHaveTextContent(/Jan 15, 2024/);

      // Check that membership expires date is visible
      const expiresLabel = screen.getByText('Membership Expires:');
      const expiresValue = expiresLabel.nextElementSibling;
      expect(expiresValue).toHaveTextContent(/Jan 15, 2025/);
    });
  });

  it('should display dash when subscription dates are missing', async () => {
    // Arrange
    const member = createMockMember({
      subscriptionStart: undefined,
      membershipExpiresAt: undefined,
    });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      const subscriptionLabel = screen.getByText('Subscription Start:');
      const subscriptionValue = subscriptionLabel.parentElement?.querySelector('dd');
      expect(subscriptionValue).toHaveTextContent('—');
    });
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
    await waitFor(() => {
      expect(screen.getByText('cus_123')).toBeVisible();
      expect(screen.getByText('sub_456')).toBeVisible();
    });
  });

  it('should not display Stripe section when not a Stripe customer', async () => {
    // Arrange
    const member = createMockMember({
      stripeCustomerId: undefined,
    });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      expect(screen.queryByText('Stripe Customer ID:')).not.toBeInTheDocument();
    });
  });

  it('should display Activate button for inactive members', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: false });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Activate Membership' })).toBeVisible();
    });
  });

  it('should display Deactivate button for active members', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: true });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Deactivate Membership' })).toBeVisible();
    });
  });

  it('should show warning for Stripe-managed subscriptions', async () => {
    // Arrange
    const member = createMockMember({
      stripeCustomerId: 'cus_123',
    });

    // Act
    await setup({ member });

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/This membership is managed by Stripe/)).toBeVisible();
    });
  });

  it('should show success message after activating membership', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: false });
    const { user } = await setup({ member });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Activate Membership' })).toBeVisible();
    });

    // Act - Click activate button to open dialog
    const activateButton = screen.getByRole('button', { name: 'Activate Membership' });
    await user.click(activateButton);

    // Click confirm in dialog
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Membership activated successfully')).toBeVisible();
    });
  });

  it('should show error message when activation fails', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: false });
    const { user } = await setup({ member, shouldFailActivate: true });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Activate Membership' })).toBeVisible();
    });

    // Act - Click activate button to open dialog
    const activateButton = screen.getByRole('button', { name: 'Activate Membership' });
    await user.click(activateButton);

    // Click confirm in dialog
    const confirmButton = screen.getByRole('button', { name: 'Confirm' });
    await user.click(confirmButton);

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Failed to activate membership.')).toBeVisible();
    });
  });

  it('should not activate when user cancels confirmation', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: false });
    const { user } = await setup({ member });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Activate Membership' })).toBeVisible();
    });

    // Act - Click activate button to open dialog
    const activateButton = screen.getByRole('button', { name: 'Activate Membership' });
    await user.click(activateButton);

    // Click cancel in dialog
    const cancelButton = screen.getByRole('button', { name: 'Cancel' });
    await user.click(cancelButton);

    // Assert - Success message should not appear
    expect(screen.queryByText('Membership activated successfully')).not.toBeInTheDocument();
  });

  it('should display error message when loading fails', async () => {
    // Arrange & Act
    await setup({ shouldFailLoad: true });

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Failed to load member details. Please try again.')).toBeVisible();
    });
  });
});
