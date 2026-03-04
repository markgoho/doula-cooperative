import { Router } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import type { Member } from '../../admin.types';
import { AdminMembersService } from '../../services/admin-members.service';
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

  it('should display Cancel Membership button for active members', async () => {
    // Arrange
    const member = createMockMember({ membershipActive: true });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByRole('button', { name: 'Cancel Membership' })).toBeVisible();
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
    const confirmButton = screen.getByRole('button', { name: 'Activate' });
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
    const confirmButton = screen.getByRole('button', { name: 'Activate' });
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

  it('should display clean slate delete button for non-admin users', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: false });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByRole('button', { name: 'Clean Slate Delete' })).toBeVisible();
    expect(screen.getByText('Clean Slate Delete', { selector: 'h3' })).toBeVisible();
  });

  it('should hide clean slate delete button for admin users', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: true });

    // Act
    await setup({ member });

    // Assert
    expect(await screen.findByText('Admin Account')).toBeVisible();
    expect(screen.queryByRole('button', { name: 'Clean Slate Delete' })).toBeNull();
  });

  it('should show confirmation dialog when clicking clean slate delete', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: false });
    const { user } = await setup({ member });

    expect(await screen.findByRole('button', { name: 'Clean Slate Delete' })).toBeVisible();

    // Act - Click clean slate delete button to open dialog
    const cleanSlateButton = screen.getByRole('button', { name: 'Clean Slate Delete' });
    await user.click(cleanSlateButton);

    // Assert
    expect(screen.getByText(/This will completely remove the user from ALL systems/)).toBeVisible();
  });

  it('should show error message when clean slate delete fails', async () => {
    // Suppress console.error during this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    // Arrange
    const member = createMockMember({ isAdmin: false });
    const { user } = await setup({ member, shouldFailCleanSlate: true });

    expect(await screen.findByRole('button', { name: 'Clean Slate Delete' })).toBeVisible();

    // Act - Click clean slate delete button to open dialog
    const cleanSlateButton = screen.getByRole('button', { name: 'Clean Slate Delete' });
    await user.click(cleanSlateButton);

    // Click confirm in dialog — use getAllByRole since button text matches both the page button and dialog button
    const cleanSlateButtons = screen.getAllByRole('button', { name: 'Clean Slate Delete' });
    const dialogConfirmButton = cleanSlateButtons.at(-1)!;
    await user.click(dialogConfirmButton);

    // Assert
    expect(await screen.findByText('Failed to perform clean slate delete.')).toBeVisible();

    consoleErrorSpy.mockRestore();
  });

  it('should navigate to members list after successful clean slate delete', async () => {
    // Arrange
    const member = createMockMember({ isAdmin: false });
    const { user, mockRouter } = await setup({ member });

    expect(await screen.findByText('Clean Slate Delete', { selector: 'h3' })).toBeVisible();

    // Act - Click clean slate delete button to open dialog
    const cleanSlateButton = screen.getByRole('button', { name: 'Clean Slate Delete' });
    await user.click(cleanSlateButton);

    // Click confirm in dialog
    const cleanSlateButtons = screen.getAllByRole('button', { name: 'Clean Slate Delete' });
    const dialogConfirmButton = cleanSlateButtons.at(-1)!;
    await user.click(dialogConfirmButton);

    // Assert
    expect(mockRouter.navigate).toHaveBeenCalledWith(['/admin/members']);
  });

  it('should display Publish Profile button when profile is draft', async () => {
    // Arrange
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true });

    // Load the profile first
    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    // Assert
    expect(await screen.findByText('Draft (Unpublished)')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Publish Profile' })).toBeVisible();
  });

  it('should display Unpublish Profile button when profile is published', async () => {
    // Arrange
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: false });

    // Load the profile first
    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    // Assert
    expect(await screen.findByText('Published')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Unpublish Profile' })).toBeVisible();
  });

  it('should show confirmation dialog when clicking Publish Profile', async () => {
    // Arrange
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true });

    // Load the profile first
    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    // Act - Click publish button to open dialog
    const publishButton = await screen.findByRole('button', { name: 'Publish Profile' });
    await user.click(publishButton);

    // Assert
    expect(
      screen.getByText(/This will publish the profile, making it visible on the public website/),
    ).toBeVisible();
  });

  it('should show success message after toggling draft status', async () => {
    // Arrange
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true });

    // Load the profile first
    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    // Act - Click publish button to open dialog
    const publishButton = await screen.findByRole('button', { name: 'Publish Profile' });
    await user.click(publishButton);

    // Click confirm in dialog
    const confirmButton = screen.getByRole('button', { name: 'Publish' });
    await user.click(confirmButton);

    // Assert
    expect(await screen.findByText('Profile published successfully')).toBeVisible();
  });

  it('should show error message when toggle draft fails', async () => {
    // Suppress console.error during this test
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {
      // Intentionally empty - we're just suppressing console output in tests
    });

    // Arrange
    const member = createMockMember({ slug: 'test-slug' });
    const { user } = await setup({ member, profileDraft: true, shouldFailToggleDraft: true });

    // Load the profile first
    const viewProfileButton = await screen.findByRole('button', { name: 'View Profile Content' });
    await user.click(viewProfileButton);

    // Act - Click publish button to open dialog
    const publishButton = await screen.findByRole('button', { name: 'Publish Profile' });
    await user.click(publishButton);

    // Click confirm in dialog
    const confirmButton = screen.getByRole('button', { name: 'Publish' });
    await user.click(confirmButton);

    // Assert
    expect(await screen.findByText('Failed to toggle profile draft status.')).toBeVisible();

    consoleErrorSpy.mockRestore();
  });
});

interface SetupOptions {
  uid?: string;
  member?: Member;
  shouldFailLoad?: boolean;
  shouldFailActivate?: boolean;
  shouldFailCancel?: boolean;
  shouldFailCleanSlate?: boolean;
  shouldFailToggleDraft?: boolean;
  shouldKeepLoading?: boolean;
  errorMessage?: string;
  profileDraft?: boolean;
}

async function setup({
  uid = 'test-uid-123',
  member,
  shouldFailLoad = false,
  shouldFailActivate = false,
  shouldFailCancel = false,
  shouldFailCleanSlate = false,
  shouldFailToggleDraft = false,
  shouldKeepLoading = false,
  errorMessage = 'Failed to load member details. Please try again.',
  profileDraft = true,
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
    cancelMembership: shouldFailCancel
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({ success: true }),
    cleanSlateDelete: shouldFailCleanSlate
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({
          success: true,
          deletedUid: uid,
          memberDocumentDeleted: true,
          authUserDeleted: true,
        }),
    readMemberProfile: vi.fn().mockResolvedValue({
      title: 'Test Doula',
      bio: 'Mock profile content',
      credentials: 'CD(DONA)',
      pronouns: 'she/her',
      tags: ['birth-doula'],
      image: 'https://example.com/image.jpg',
      slug: 'test-slug',
      draft: profileDraft,
    }),
    toggleProfileDraft: shouldFailToggleDraft
      ? vi.fn().mockRejectedValue(new Error('Failed'))
      : vi.fn().mockResolvedValue({
          success: true,
          slug: 'test-slug',
          draft: !profileDraft,
        }),
  };

  const mockRouter = {
    navigate: vi.fn().mockResolvedValue(true),
  };

  const component = await render(AdminMemberDetail, {
    providers: [
      { provide: AdminMembersService, useValue: mockAdminMembersService },
      { provide: Router, useValue: mockRouter },
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
    mockRouter,
  };
}

function createMockMember(overrides: Partial<Member> = {}): Member {
  return {
    uid: 'test-uid-123',
    email: 'test@example.com',
    name: 'Test User',
    createdAt: '2024-01-15T10:30:00.000Z',
    isAdmin: false,
    membershipActive: false,
    subscriptionStart: '2024-01-01T00:00:00.000Z',
    membershipExpiresAt: '2025-01-01T00:00:00.000Z',
    ...overrides,
  };
}
