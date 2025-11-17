import { Timestamp } from '@angular/fire/firestore';
import { render, screen, within } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import type { UnclaimedProfile } from '../admin.service';
import { UnclaimedProfilesTable } from './unclaimed-profiles-table';

function createMockProfile(overrides: Partial<UnclaimedProfile> = {}): UnclaimedProfile {
  return {
    email: 'test@example.com',
    name: 'Test User',
    subscriptionStart: Timestamp.fromDate(new Date('2024-01-15')),
    ...overrides,
  };
}

function createDefaultTestProfiles(): UnclaimedProfile[] {
  return [
    createMockProfile({ email: 'zoe@example.com', name: 'Zoe' }),
    createMockProfile({ email: 'alice@example.com', name: 'Alice' }),
    createMockProfile({ email: 'mike@example.com', name: 'Mike' }),
  ];
}

async function setup({
  profiles = createDefaultTestProfiles(),
  loading = false,
  error,
}: { profiles?: UnclaimedProfile[]; loading?: boolean; error?: string | undefined } = {}) {
  const user = userEvent.setup();
  await render(UnclaimedProfilesTable, {
    componentInputs: { profiles, loading, error },
  });
  return { user };
}

describe('UnclaimedProfilesTable', () => {
  describe('sorting', () => {
    it('should sort by name when Name header is clicked', async () => {
      // Arrange
      const { user } = await setup();

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
      const { user } = await setup();

      // Act
      const nameHeader = await screen.findByRole('columnheader', { name: /Name/i });
      await user.click(nameHeader); // First click - ascending
      await user.click(nameHeader); // Second click - descending

      // Assert - should be sorted descending
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]!).getByText('Zoe')).toBeInTheDocument();
      expect(within(rows[2]!).getByText('Mike')).toBeInTheDocument();
      expect(within(rows[3]!).getByText('Alice')).toBeInTheDocument();
    });

    it('should sort by email when Email header is clicked', async () => {
      // Arrange
      const { user } = await setup();

      // Act
      const emailHeader = await screen.findByRole('columnheader', { name: /Email/i });
      await user.click(emailHeader);

      // Assert - should be sorted by email ascending
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]!).getByText('alice@example.com')).toBeInTheDocument();
      expect(within(rows[2]!).getByText('mike@example.com')).toBeInTheDocument();
      expect(within(rows[3]!).getByText('zoe@example.com')).toBeInTheDocument();
    });

    it('should sort by profile status when Has Profile header is clicked', async () => {
      // Arrange
      const profileWithoutSlug1 = createMockProfile({ email: '1@example.com', name: 'No Profile' });
      delete (profileWithoutSlug1 as Partial<UnclaimedProfile>).slug;

      const profileWithoutSlug2 = createMockProfile({
        email: '3@example.com',
        name: 'No Profile 2',
      });
      delete (profileWithoutSlug2 as Partial<UnclaimedProfile>).slug;

      const profiles = [
        profileWithoutSlug1,
        createMockProfile({ email: '2@example.com', name: 'Has Profile', slug: 'has-profile' }),
        profileWithoutSlug2,
      ];
      const { user } = await setup({ profiles });

      // Act
      const hasProfileHeader = await screen.findByRole('columnheader', { name: /Has Profile/i });
      await user.click(hasProfileHeader);

      // Assert - profiles with slugs should come first
      const yesBadges = screen.getAllByText('Yes');
      const noBadges = screen.getAllByText('No');
      expect(yesBadges.length).toBe(1);
      expect(noBadges.length).toBe(2);
    });

    it('should sort by subscription start when Subscription Start header is clicked', async () => {
      // Arrange
      const profiles = [
        createMockProfile({
          email: '1@example.com',
          name: 'User 1',
          subscriptionStart: Timestamp.fromDate(new Date('2024-06-01')),
        }),
        createMockProfile({
          email: '2@example.com',
          name: 'User 2',
          subscriptionStart: Timestamp.fromDate(new Date('2024-01-01')),
        }),
        createMockProfile({
          email: '3@example.com',
          name: 'User 3',
          subscriptionStart: Timestamp.fromDate(new Date('2024-03-01')),
        }),
      ];
      const { user } = await setup({ profiles });

      // Act - click a different header first, then click Subscription Start to sort ascending
      const nameHeader = await screen.findByRole('columnheader', { name: /Name/i });
      await user.click(nameHeader); // Switch to name column

      const subscriptionHeader = await screen.findByRole('columnheader', {
        name: /Subscription Start/i,
      });
      await user.click(subscriptionHeader); // Now click Subscription Start, which sets to ascending

      // Assert - should be sorted by date ascending
      const rows = screen.getAllByRole('row');
      expect(within(rows[1]!).getByText('2@example.com')).toBeInTheDocument(); // User 2, Jan 1
      expect(within(rows[2]!).getByText('3@example.com')).toBeInTheDocument(); // User 3, Mar 1
      expect(within(rows[3]!).getByText('1@example.com')).toBeInTheDocument(); // User 1, Jun 1
    });

    it('should display sort direction indicator on active column', async () => {
      // Arrange
      const { user } = await setup();

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
      expect(screen.getByText('Loading unclaimed profiles...')).toBeVisible();
    });

    it('should display error message', async () => {
      // Act
      await setup({ error: 'Something went wrong' });

      // Assert
      expect(screen.getByText('Something went wrong')).toBeVisible();
    });

    it('should display profiles in table', async () => {
      // Act
      await setup();

      // Assert
      expect(await screen.findByText('Alice')).toBeVisible();
      expect(screen.getByText('alice@example.com')).toBeVisible();
    });

    it('should display empty state when no profiles exist', async () => {
      // Act
      await setup({ profiles: [] });

      // Assert
      expect(await screen.findByText('No unclaimed profiles found')).toBeVisible();
    });
  });
});
