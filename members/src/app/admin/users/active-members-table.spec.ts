import { Timestamp } from '@angular/fire/firestore';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { Member } from '../admin.service';
import { ActiveMembersTable } from './active-members-table';

function createMockMember(overrides: Partial<Member> = {}): Member {
  return {
    uid: 'test-uid-123',
    email: 'test@example.com',
    createdAt: Timestamp.fromDate(new Date('2024-01-15')),
    membershipActive: false,
    ...overrides,
  };
}

async function setup({
  members = [],
  loading = false,
  error,
}: { members?: Member[]; loading?: boolean; error?: string | undefined } = {}) {
  const user = userEvent.setup();
  await render(ActiveMembersTable, {
    componentInputs: { members, loading, error },
  });
  return { user };
}

describe('ActiveMembersTable', () => {
  describe('sorting', () => {
    it('should sort by name when Name header is clicked', async () => {
      // Arrange
      const members = [
        createMockMember({ uid: '1', name: 'Zoe', email: 'zoe@example.com' }),
        createMockMember({ uid: '2', name: 'Alice', email: 'alice@example.com' }),
        createMockMember({ uid: '3', name: 'Mike', email: 'mike@example.com' }),
      ];
      const { user } = await setup({ members });

      // Act
      const nameHeader = await screen.findByRole('columnheader', { name: /Name/i });
      await user.click(nameHeader);

      // Assert - should be sorted alphabetically ascending
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]!).getByText('Alice')).toBeInTheDocument();
      expect(within(rows[2]!).getByText('Mike')).toBeInTheDocument();
      expect(within(rows[3]!).getByText('Zoe')).toBeInTheDocument();
    });

    it('should toggle sort direction when clicking the same header twice', async () => {
      // Arrange
      const members = [
        createMockMember({ uid: '1', name: 'Alice', email: 'alice@example.com' }),
        createMockMember({ uid: '2', name: 'Bob', email: 'bob@example.com' }),
        createMockMember({ uid: '3', name: 'Charlie', email: 'charlie@example.com' }),
      ];
      const { user } = await setup({ members });

      // Act
      const nameHeader = await screen.findByRole('columnheader', { name: /Name/i });
      await user.click(nameHeader); // First click - ascending
      await user.click(nameHeader); // Second click - descending

      // Assert - should be sorted descending
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]!).getByText('Charlie')).toBeInTheDocument();
      expect(within(rows[2]!).getByText('Bob')).toBeInTheDocument();
      expect(within(rows[3]!).getByText('Alice')).toBeInTheDocument();
    });

    it('should sort by email when Email header is clicked', async () => {
      // Arrange
      const members = [
        createMockMember({ uid: '1', name: 'Person Z', email: 'zebra@example.com' }),
        createMockMember({ uid: '2', name: 'Person A', email: 'alpha@example.com' }),
        createMockMember({ uid: '3', name: 'Person M', email: 'mike@example.com' }),
      ];
      const { user } = await setup({ members });

      // Act
      const emailHeader = await screen.findByRole('columnheader', { name: /Email/i });
      await user.click(emailHeader);

      // Assert - should be sorted by email ascending
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]!).getByText('alpha@example.com')).toBeInTheDocument();
      expect(within(rows[2]!).getByText('mike@example.com')).toBeInTheDocument();
      expect(within(rows[3]!).getByText('zebra@example.com')).toBeInTheDocument();
    });

    it('should sort by membership status when Membership header is clicked', async () => {
      // Arrange
      const members = [
        createMockMember({ uid: '1', name: 'Inactive User', membershipActive: false }),
        createMockMember({ uid: '2', name: 'Active User', membershipActive: true }),
        createMockMember({ uid: '3', name: 'Another Inactive', membershipActive: false }),
      ];
      const { user } = await setup({ members });

      // Act
      const membershipHeader = await screen.findByRole('columnheader', { name: /Membership/i });
      await user.click(membershipHeader);

      // Assert - active members should come first
      const activeBadges = screen.getAllByText('Active');
      const inactiveBadges = screen.getAllByText('Inactive');
      expect(activeBadges.length).toBe(1);
      expect(inactiveBadges.length).toBe(2);
    });

    it('should sort by creation date when Created header is clicked', async () => {
      // Arrange
      const members = [
        createMockMember({
          uid: '1',
          email: 'user1@example.com',
          createdAt: Timestamp.fromDate(new Date('2024-06-01')),
        }),
        createMockMember({
          uid: '2',
          email: 'user2@example.com',
          createdAt: Timestamp.fromDate(new Date('2024-01-01')),
        }),
        createMockMember({
          uid: '3',
          email: 'user3@example.com',
          createdAt: Timestamp.fromDate(new Date('2024-03-01')),
        }),
      ];
      const { user } = await setup({ members });

      // Act - click a different header first, then click Created to sort by created ascending
      const nameHeader = await screen.findByRole('columnheader', { name: /Name/i });
      await user.click(nameHeader); // Switch to name column

      const createdHeader = await screen.findByRole('columnheader', { name: /Created/i });
      await user.click(createdHeader); // Now click Created, which sets to ascending

      // Assert - should be sorted by date ascending
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]!).getByText('user2@example.com')).toBeInTheDocument(); // Jan 1
      expect(within(rows[2]!).getByText('user3@example.com')).toBeInTheDocument(); // Mar 1
      expect(within(rows[3]!).getByText('user1@example.com')).toBeInTheDocument(); // Jun 1
    });

    it('should handle members with missing names when sorting by name', async () => {
      // Arrange
      const memberWithoutName = createMockMember({ uid: '1', email: 'no-name@example.com' });
      delete (memberWithoutName as Partial<Member>).name;

      const members = [
        memberWithoutName,
        createMockMember({ uid: '2', name: 'Alice', email: 'alice@example.com' }),
        createMockMember({ uid: '3', name: 'Bob', email: 'bob@example.com' }),
      ];
      const { user } = await setup({ members });

      // Act
      const nameHeader = await screen.findByRole('columnheader', { name: /Name/i });
      await user.click(nameHeader);

      // Assert - members with names should be sorted, member without name should be at the beginning
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]!).getByText('—')).toBeInTheDocument(); // No name
      expect(within(rows[2]!).getByText('Alice')).toBeInTheDocument();
      expect(within(rows[3]!).getByText('Bob')).toBeInTheDocument();
    });

    it('should display sort direction indicator on active column', async () => {
      // Arrange
      const members = [createMockMember()];
      const { user } = await setup({ members });

      // Act
      const nameHeader = await screen.findByRole('columnheader', { name: /Name/i });
      await user.click(nameHeader);

      // Assert - should show ascending arrow
      expect(nameHeader).toHaveTextContent('↑');

      // Act - click again
      await user.click(nameHeader);

      // Assert - should show descending arrow
      expect(nameHeader).toHaveTextContent('↓');
    });
  });

  describe('display', () => {
    it('should display loading state', async () => {
      // Act
      await setup({ loading: true });

      // Assert
      expect(screen.getByText('Loading members...')).toBeVisible();
    });

    it('should display error message', async () => {
      // Act
      await setup({ error: 'Something went wrong' });

      // Assert
      expect(screen.getByText('Something went wrong')).toBeVisible();
    });

    it('should display members in table', async () => {
      // Arrange
      const members = [
        createMockMember({
          uid: 'user-1',
          name: 'Alice Smith',
          email: 'alice@example.com',
          membershipActive: true,
        }),
      ];

      // Act
      await setup({ members });

      // Assert
      expect(await screen.findByText('Alice Smith')).toBeVisible();
      expect(screen.getByText('alice@example.com')).toBeVisible();
      expect(screen.getByText('Active')).toBeVisible();
    });

    it('should display empty state when no members exist', async () => {
      // Act
      await setup({ members: [] });

      // Assert
      expect(await screen.findByText('No members found')).toBeVisible();
    });
  });
});
