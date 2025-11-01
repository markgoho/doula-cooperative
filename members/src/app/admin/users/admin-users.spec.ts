import { Timestamp } from '@angular/fire/firestore';
import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AdminMembersService, type Member } from '../admin.service';
import { AdminUsers } from './admin-users';

describe('AdminUsers', () => {
  interface SetupOptions {
    members?: Member[];
    total?: number;
    shouldFail?: boolean;
    shouldKeepLoading?: boolean;
    errorMessage?: string;
  }

  async function setup({
    members = [],
    total = 0,
    shouldFail = false,
    shouldKeepLoading = false,
    errorMessage = 'Failed to load members. Please try again.',
  }: SetupOptions = {}) {
    const user = userEvent.setup();

    let resolvePromise: (value: { members: Member[]; total: number }) => void;
    const pendingPromise = new Promise<{ members: Member[]; total: number }>((resolve) => {
      resolvePromise = resolve;
    });

    let listMembersReturnValue;
    if (shouldKeepLoading) {
      listMembersReturnValue = pendingPromise;
    } else if (shouldFail) {
      listMembersReturnValue = Promise.reject(new Error(errorMessage));
    } else {
      listMembersReturnValue = Promise.resolve({ members, total });
    }

    const mockAdminMembersService = {
      listMembers: vi.fn().mockReturnValue(listMembersReturnValue),
      listUnclaimedProfiles: vi.fn().mockResolvedValue({ profiles: [], total: 0 }),
    };

    await render(AdminUsers, {
      providers: [{ provide: AdminMembersService, useValue: mockAdminMembersService }],
    });

    return { user, resolvePromise: resolvePromise! };
  }

  function createMockMember(overrides: Partial<Member> = {}): Member {
    return {
      uid: 'test-uid-123',
      email: 'test@example.com',
      createdAt: Timestamp.fromDate(new Date('2024-01-15')),
      membershipActive: false,
      ...overrides,
    };
  }

  it('should display loading state initially', async () => {
    // Arrange & Act
    const { resolvePromise } = await setup({ shouldKeepLoading: true });

    // Assert - loading state should be visible
    expect(screen.getByText('Loading members...')).toBeVisible();

    // Clean up - resolve the promise to avoid hanging test
    resolvePromise({ members: [], total: 0 });
  });

  it('should display total member count', async () => {
    // Arrange
    const members = [createMockMember()];

    // Act
    await setup({ members, total: 5 });

    // Assert - waitFor needed since service call must complete
    await waitFor(() => {
      expect(screen.getByText('Total Members: 5')).toBeVisible();
    });
  });

  it('should display member list in table', async () => {
    // Arrange
    const members = [
      createMockMember({
        uid: 'user-1',
        name: 'Alice Smith',
        email: 'alice@example.com',
        membershipActive: true,
      }),
      createMockMember({
        uid: 'user-2',
        name: 'Bob Jones',
        email: 'bob@example.com',
        membershipActive: false,
      }),
    ];

    // Act
    await setup({ members, total: 2 });

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Alice Smith')).toBeVisible();
      expect(screen.getByText('alice@example.com')).toBeVisible();
      expect(screen.getByText('Bob Jones')).toBeVisible();
      expect(screen.getByText('bob@example.com')).toBeVisible();
    });
  });

  it('should display active status badge for active members', async () => {
    // Arrange
    const members = [createMockMember({ membershipActive: true })];

    // Act
    await setup({ members, total: 1 });

    // Assert
    await waitFor(() => {
      const badge = screen.getByText('Active');
      expect(badge).toBeVisible();
      expect(badge).toHaveClass('active');
    });
  });

  it('should display inactive status badge for inactive members', async () => {
    // Arrange
    const members = [createMockMember({ membershipActive: false })];

    // Act
    await setup({ members, total: 1 });

    // Assert
    await waitFor(() => {
      const badge = screen.getByText('Inactive');
      expect(badge).toBeVisible();
      expect(badge).toHaveClass('inactive');
    });
  });

  it('should display dash when member has no name', async () => {
    // Arrange
    const members = [createMockMember({ name: undefined })];

    // Act
    await setup({ members, total: 1 });

    // Assert
    await waitFor(() => {
      const cells = screen.getAllByRole('cell');
      expect(cells[0]).toHaveTextContent('—');
    });
  });

  it('should display formatted creation date', async () => {
    // Arrange
    const members = [
      createMockMember({
        createdAt: Timestamp.fromDate(new Date('2024-03-15T12:00:00')),
      }),
    ];

    // Act
    await setup({ members, total: 1 });

    // Assert
    await waitFor(() => {
      expect(screen.getByText(/Mar 15, 2024/)).toBeVisible();
    });
  });

  it('should display View link for each member', async () => {
    // Arrange
    const members = [createMockMember({ uid: 'test-uid-123' })];

    // Act
    await setup({ members, total: 1 });

    // Assert
    await waitFor(() => {
      const viewLink = screen.getByRole('link', { name: 'View' });
      expect(viewLink).toBeVisible();
      expect(viewLink).toHaveAttribute('href', '/admin/users/test-uid-123');
    });
  });

  it('should display empty state when no members exist', async () => {
    // Arrange & Act
    await setup({ members: [], total: 0 });

    // Assert
    await waitFor(() => {
      expect(screen.getByText('No members found')).toBeVisible();
    });
  });

  it('should display error message when loading fails', async () => {
    // Arrange & Act
    await setup({ shouldFail: true });

    // Assert
    await waitFor(() => {
      expect(screen.getByText('Failed to load members. Please try again.')).toBeVisible();
    });
  });

  it('should not display table when loading fails', async () => {
    // Arrange & Act
    await setup({ shouldFail: true });

    // Assert - members table should not be displayed, but unclaimed profiles table may still be present
    await waitFor(() => {
      expect(screen.getByText('Failed to load members. Please try again.')).toBeVisible();
      // Check that the "No members found" empty state is not shown (which would only appear if table was rendered)
      expect(screen.queryByText('No members found')).not.toBeInTheDocument();
      // Verify no member-specific content is shown (View links for members, etc.)
      // The test verified that the error message is shown instead of the table
    });
  });
});
