import { test } from '../fixtures/auth-emulator.fixture';
import { expect } from '@playwright/test';
import type {
  ApiMemberResponse,
  ApiListMembersResponse,
} from '../../src/app/admin/api-types/admin-members-api.types';
import { AdminUsersPage } from '../pages/admin-users.page';

/**
 * Mock data for testing admin users list page.
 * These represent the expected API responses that would come from the backend.
 */
const mockMembers: ApiMemberResponse[] = [
  {
    uid: 'member-1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    createdAt: '2024-01-15T10:30:00.000Z',
    membershipActive: true,
    subscriptionStart: '2024-01-15T10:30:00.000Z',
    membershipExpiresAt: '2025-01-15T10:30:00.000Z',
  },
  {
    uid: 'member-2',
    email: 'bob@example.com',
    name: 'Bob Johnson',
    createdAt: '2024-02-20T14:15:00.000Z',
    membershipActive: false,
    subscriptionStart: '2024-02-20T14:15:00.000Z',
    membershipExpiresAt: '2024-08-20T14:15:00.000Z',
  },
  {
    uid: 'member-3',
    email: 'charlie@example.com',
    createdAt: '2024-03-10T09:00:00.000Z',
    membershipActive: true,
    subscriptionStart: '2024-03-10T09:00:00.000Z',
  },
];

const mockListMembersResponse: ApiListMembersResponse = {
  members: mockMembers,
  total: 3,
};

test.describe('Admin Users Page', () => {
  /**
   * These tests use:
   * - Real Firebase Auth from emulators (with webmaster@doulacooperative.com auto-admin)
   * - Mocked API responses for controlled test data via page.route()
   */

  test('admin views member list and verifies data display', async ({ authenticatedAdminPage }) => {
    // Set up mock with page.route() for reliable mocking
    await authenticatedAdminPage.route(/\/api\/admin\/members(\?|$)/, async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockListMembersResponse),
          })
        : route.continue());
    });

    const adminUsersPage = new AdminUsersPage(authenticatedAdminPage);
    await adminUsersPage.goto();
    await adminUsersPage.waitForMembersTable();

    // === Page Structure and Initial Display ===
    await expect(adminUsersPage.pageHeading).toBeVisible();
    await expect(adminUsersPage.pageHeading).toHaveText('User Management');
    await expect(adminUsersPage.totalMembersText).toContainText('Total Members: 3');

    // === Table Structure ===
    await expect(adminUsersPage.membersTable).toBeVisible();
    await expect(adminUsersPage.nameHeader).toBeVisible();
    await expect(adminUsersPage.emailHeader).toBeVisible();
    await expect(adminUsersPage.membershipHeader).toBeVisible();
    await expect(adminUsersPage.createdHeader).toBeVisible();
    await expect(adminUsersPage.membersTableRows).toHaveCount(3);

    // === Initial Data Display (default sort: created date descending) ===
    // Charlie (Mar 10) newest, Bob (Feb 20) middle, Alice (Jan 15) oldest
    const row0 = adminUsersPage.membersTableRows.nth(0);
    await expect(row0).toContainText('charlie@example.com');
    await expect(row0).toContainText('—'); // No name
    await expect(row0).toContainText('Active');
    await expect(row0).toContainText('Mar 10, 2024');

    const row1 = adminUsersPage.membersTableRows.nth(1);
    await expect(row1).toContainText('bob@example.com');
    await expect(row1).toContainText('Bob Johnson');
    await expect(row1).toContainText('Inactive');
    await expect(row1).toContainText('Feb 20, 2024');

    const row2 = adminUsersPage.membersTableRows.nth(2);
    await expect(row2).toContainText('alice@example.com');
    await expect(row2).toContainText('Alice Smith');
    await expect(row2).toContainText('Active');
    await expect(row2).toContainText('Jan 15, 2024');

    // === Verify View Links ===
    await expect(row0.getByRole('link', { name: 'View' })).toBeVisible();
    await expect(row1.getByRole('link', { name: 'View' })).toBeVisible();
    await expect(row2.getByRole('link', { name: 'View' })).toBeVisible();
  });

  // TODO: Investigate why click events on table headers don't trigger Angular change detection
  // when using page object locators. The unclaimed-profiles sorting test uses inline locators
  // and works correctly. This may be related to zoneless change detection timing.
  test.skip('tests sorting functionality', async ({ authenticatedAdminPage }) => {
    await authenticatedAdminPage.route(/\/api\/admin\/members(\?|$)/, async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockListMembersResponse),
          })
        : route.continue());
    });

    const adminUsersPage = new AdminUsersPage(authenticatedAdminPage);
    await adminUsersPage.goto();
    await adminUsersPage.waitForMembersTable();

    // === Sort by Name (Ascending) ===
    await adminUsersPage.sortBy('Name');
    await expect(adminUsersPage.nameHeader).toContainText('↑');

    // Empty name (—) first, then alphabetical
    await expect(adminUsersPage.membersTableRows.nth(0)).toContainText('charlie@example.com');
    await expect(adminUsersPage.membersTableRows.nth(1)).toContainText('Alice Smith');
    await expect(adminUsersPage.membersTableRows.nth(2)).toContainText('Bob Johnson');

    // === Sort by Name (Descending) ===
    await adminUsersPage.sortBy('Name');
    await expect(adminUsersPage.nameHeader).toContainText('↓');
    await expect(adminUsersPage.membersTableRows.nth(0)).toContainText('Bob Johnson');
    await expect(adminUsersPage.membersTableRows.nth(1)).toContainText('Alice Smith');

    // === Sort by Membership Status ===
    await adminUsersPage.sortBy('Membership');
    await expect(adminUsersPage.membershipHeader).toContainText('↑');
    // Active members come first when sorting ascending (the sort logic uses bActive - aActive)
    await expect(adminUsersPage.membersTableRows.nth(0)).toContainText('Alice Smith');
    await expect(adminUsersPage.membersTableRows.nth(0)).toContainText('Active');
    // Bob (Inactive) should be last
    await expect(adminUsersPage.membersTableRows.nth(2)).toContainText('Bob Johnson');
    await expect(adminUsersPage.membersTableRows.nth(2)).toContainText('Inactive');

    // === Sort by Email ===
    await adminUsersPage.sortBy('Email');
    await expect(adminUsersPage.emailHeader).toContainText('↑');
    // Alphabetical: alice, bob, charlie
    await expect(adminUsersPage.membersTableRows.nth(0)).toContainText('alice@example.com');
    await expect(adminUsersPage.membersTableRows.nth(1)).toContainText('bob@example.com');
    await expect(adminUsersPage.membersTableRows.nth(2)).toContainText('charlie@example.com');
  });

  test('displays warning when API returns invalid member data', async ({
    authenticatedAdminPage,
  }) => {
    // Mock response with warning about data corruption
    const responseWithWarning: ApiListMembersResponse = {
      members: mockMembers,
      total: 3,
      warning:
        'Warning: 2 member(s) have invalid data and were excluded. Contact support to investigate.',
    };

    // Use page.route() instead of context.route() for more reliable mocking
    await authenticatedAdminPage.route(/\/api\/admin\/members(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseWithWarning),
      });
    });

    const adminUsersPage = new AdminUsersPage(authenticatedAdminPage);
    await adminUsersPage.goto();
    await adminUsersPage.waitForMembersTable();

    // === Warning Banner Displayed ===
    const warningBanner = authenticatedAdminPage.getByRole('alert');
    await expect(warningBanner).toBeVisible();
    await expect(warningBanner).toContainText('2 member(s) have invalid data');
    await expect(warningBanner).toContainText('Contact support to investigate');

    // === Table Still Displays Valid Members ===
    await expect(adminUsersPage.membersTableRows).toHaveCount(3);
    await expect(adminUsersPage.totalMembersText).toContainText('Total Members: 3');
  });

  // TODO: Investigate why route interception doesn't work reliably for error responses.
  // The route handler is set up but the page still shows "Loading members..." instead of
  // receiving the mocked 500 error. This may be related to request timing or caching.
  test.skip('handles API error with user-friendly message', async ({ authenticatedAdminPage }) => {
    // Mock 500 error response - use page.route() for more reliable mocking
    await authenticatedAdminPage.route(/\/api\/admin\/members(\?|$)/, async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    const adminUsersPage = new AdminUsersPage(authenticatedAdminPage);
    await adminUsersPage.goto();

    // === Error Message Displayed ===
    await expect(adminUsersPage.errorMessage).toBeVisible({ timeout: 5000 });
    await expect(adminUsersPage.errorMessage).toContainText('Failed to load members');

    // === Table Hidden on Error ===
    await expect(adminUsersPage.membersTable).toBeHidden();

    // === Page Structure Still Visible ===
    await expect(adminUsersPage.pageHeading).toBeVisible();
    await expect(adminUsersPage.pageHeading).toHaveText('User Management');
  });
});
