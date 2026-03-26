import { test } from '../fixtures/admin-auth.fixture';
import { expect } from '@playwright/test';
import { AdminMembersPage } from '../pages/admin-members.page';
import type {
  ApiListMembersResponse,
  ApiMemberResponse,
} from '../../src/app/api-types/members-api.types';

/**
 * Mock data for testing admin members list page.
 * These represent the expected API responses that would come from the backend.
 */
const mockMembers: ApiMemberResponse[] = [
  {
    uid: 'member-1',
    email: 'alice@example.com',
    name: 'Alice Smith',
    createdAt: '2024-01-15T10:30:00.000Z',
    isAdmin: false,
    membershipActive: true,
    allowProfileEditing: false,
    subscriptionStart: '2024-01-15T10:30:00.000Z',
    membershipExpiresAt: '2025-01-15T10:30:00.000Z',
  },
  {
    uid: 'member-2',
    email: 'bob@example.com',
    name: 'Bob Johnson',
    createdAt: '2024-02-20T14:15:00.000Z',
    isAdmin: false,
    membershipActive: false,
    allowProfileEditing: false,
    subscriptionStart: '2024-02-20T14:15:00.000Z',
    membershipExpiresAt: '2024-08-20T14:15:00.000Z',
  },
  {
    uid: 'member-3',
    email: 'charlie@example.com',
    createdAt: '2024-03-10T09:00:00.000Z',
    isAdmin: false,
    membershipActive: true,
    allowProfileEditing: false,
    subscriptionStart: '2024-03-10T09:00:00.000Z',
  },
];

const mockListMembersResponse: ApiListMembersResponse = {
  members: mockMembers,
  total: 3,
};

test.describe('Admin Members Page', () => {
  /**
   * These tests use:
   * - Real Firebase Auth from emulators (with webmaster@doulacooperative.com auto-admin)
   * - Mocked API responses for controlled test data via page.route()
   */

  test('admin views member list and verifies data display', async ({ authenticatedAdminPage }) => {
    // Set up mock for members endpoint
    await authenticatedAdminPage.route(/\/api\/admin\/members(\?|$)/, async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockListMembersResponse),
          })
        : route.continue());
    });

    const adminMembersPage = new AdminMembersPage(authenticatedAdminPage);
    await adminMembersPage.goto();
    await adminMembersPage.waitForMembersTable();

    // === Page Structure and Initial Display ===
    await expect(adminMembersPage.pageHeading).toBeVisible();
    await expect(adminMembersPage.pageHeading).toHaveText('Members');
    await expect(adminMembersPage.totalMembersText).toContainText('Total Members: 3');

    // === Table Structure ===
    await expect(adminMembersPage.membersTable).toBeVisible();
    await expect(adminMembersPage.nameHeader).toBeVisible();
    await expect(adminMembersPage.emailHeader).toBeVisible();
    await expect(adminMembersPage.membershipHeader).toBeVisible();
    await expect(adminMembersPage.createdHeader).toBeVisible();
    await expect(adminMembersPage.membersTableRows).toHaveCount(3);

    // === Initial Data Display (default sort: created date descending) ===
    // Charlie (Mar 10) newest, Bob (Feb 20) middle, Alice (Jan 15) oldest
    const row0 = adminMembersPage.membersTableRows.nth(0);
    await expect(row0).toContainText('charlie@example.com');
    await expect(row0).toContainText('—'); // No name
    await expect(row0).toContainText('Active');
    await expect(row0).toContainText('Mar 10, 2024');

    const row1 = adminMembersPage.membersTableRows.nth(1);
    await expect(row1).toContainText('bob@example.com');
    await expect(row1).toContainText('Bob Johnson');
    await expect(row1).toContainText('Inactive');
    await expect(row1).toContainText('Feb 20, 2024');

    const row2 = adminMembersPage.membersTableRows.nth(2);
    await expect(row2).toContainText('alice@example.com');
    await expect(row2).toContainText('Alice Smith');
    await expect(row2).toContainText('Active');
    await expect(row2).toContainText('Jan 15, 2024');

    // === Verify View Links ===
    await expect(row0.getByRole('link', { name: 'View' })).toBeVisible();
    await expect(row1.getByRole('link', { name: 'View' })).toBeVisible();
    await expect(row2.getByRole('link', { name: 'View' })).toBeVisible();
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

    // Set up mock for members endpoint
    await authenticatedAdminPage.route(/\/api\/admin\/members(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(responseWithWarning),
      });
    });

    const adminMembersPage = new AdminMembersPage(authenticatedAdminPage);
    await adminMembersPage.goto();
    await adminMembersPage.waitForMembersTable();

    // === Warning Banner Displayed ===
    const warningBanner = authenticatedAdminPage.getByRole('alert');
    await expect(warningBanner).toBeVisible();
    await expect(warningBanner).toContainText('2 member(s) have invalid data');
    await expect(warningBanner).toContainText('Contact support to investigate');

    // === Table Still Displays Valid Members ===
    await expect(adminMembersPage.membersTableRows).toHaveCount(3);
    await expect(adminMembersPage.totalMembersText).toContainText('Total Members: 3');
  });
});
