import { test, expect } from '../fixtures/admin-auth.fixture';
import type {
  ApiUnclaimedProfileResponse,
  ApiListUnclaimedProfilesResponse,
} from '../../src/app/admin/api-types/admin-unclaimed-profiles-api.types';
import { AdminUnclaimedProfileDetailPage } from '../pages/admin-unclaimed-profile-detail.page';
import { AdminUsersPage } from '../pages/admin-users.page';

/**
 * Mock data for testing admin unclaimed profiles.
 * These represent the expected API responses that would come from the backend.
 */
const mockUnclaimedProfiles: ApiUnclaimedProfileResponse[] = [
  {
    email: 'alice.unclaimed@example.com',
    name: 'Alice Unclaimed',
    subscriptionStart: '2024-01-15T10:30:00.000Z',
    lastPayment: '2024-01-15T10:30:00.000Z',
    nextPayment: '2025-01-15T10:30:00.000Z',
    slug: 'alice-unclaimed',
    invitationEmailStatus: 'sent',
    invitationEmailSentAt: '2024-01-16T10:00:00.000Z',
  },
  {
    email: 'bob.unclaimed@example.com',
    name: 'Bob Unclaimed',
    subscriptionStart: '2024-02-20T14:15:00.000Z',
    lastPayment: '2024-02-20T14:15:00.000Z',
    nextPayment: '2025-02-20T14:15:00.000Z',
  },
  {
    email: 'charlie.unclaimed@example.com',
    name: 'Charlie Unclaimed',
    subscriptionStart: '2024-03-10T09:00:00.000Z',
    lastPayment: '2024-03-10T09:00:00.000Z',
    nextPayment: '2025-03-10T09:00:00.000Z',
    slug: 'charlie-unclaimed',
  },
];

const mockListUnclaimedProfilesResponse: ApiListUnclaimedProfilesResponse = {
  profiles: mockUnclaimedProfiles,
  total: 3,
};

test.describe('Admin Unclaimed Profiles', () => {
  /**
   * These tests use:
   * - Real Firebase Auth from emulators (with webmaster@doulacooperative.com auto-admin)
   * - Mocked API responses for controlled test data via page.route()
   */

  test('admin views unclaimed profiles list, verifies data, and tests sorting functionality', async ({
    authenticatedAdminPage,
  }) => {
    // Set up mocks for both members and unclaimed profiles
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/api/admin/members/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ members: [], total: 0 }),
        });
        return;
      }

      if (url.includes('/api/admin/unclaimed-profiles/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockListUnclaimedProfilesResponse),
        });
        return;
      }

      await route.continue();
    });

    const adminUsersPage = new AdminUsersPage(authenticatedAdminPage);
    await adminUsersPage.goto();
    await adminUsersPage.waitForMembersTable();

    // === Page Structure and Stats ===
    await expect(adminUsersPage.pageHeading).toBeVisible();
    await expect(adminUsersPage.pageHeading).toHaveText('User Management');

    // Verify header stats
    const headerStats = authenticatedAdminPage.locator('.header-stats');
    await expect(headerStats).toContainText('Total Members: 0');
    await expect(headerStats).toContainText('Unclaimed Profiles: 3');

    // === Unclaimed Profiles Table Structure ===
    const unclaimedTable = authenticatedAdminPage.locator('app-unclaimed-profiles-table table');
    await expect(unclaimedTable).toBeVisible();

    // Check table headers
    const nameHeader = unclaimedTable.getByRole('columnheader', { name: /Name/ });
    const emailHeader = unclaimedTable.getByRole('columnheader', { name: /Email/ });
    const hasProfileHeader = unclaimedTable.getByRole('columnheader', { name: /Has Profile/ });
    const subscriptionHeader = unclaimedTable.getByRole('columnheader', { name: /Subscription Start/ });

    await expect(nameHeader).toBeVisible();
    await expect(emailHeader).toBeVisible();
    await expect(hasProfileHeader).toBeVisible();
    await expect(subscriptionHeader).toBeVisible();

    // === Initial Data Display (default sort: subscription start descending) ===
    const tableRows = unclaimedTable.locator('tbody tr');
    await expect(tableRows).toHaveCount(3);

    // Charlie (Mar 10) newest, Bob (Feb 20) middle, Alice (Jan 15) oldest
    const row0 = tableRows.nth(0);
    await expect(row0).toContainText('charlie.unclaimed@example.com');
    await expect(row0).toContainText('Charlie Unclaimed');
    await expect(row0).toContainText('Yes'); // Has profile
    await expect(row0).toContainText('Mar 10, 2024');

    const row1 = tableRows.nth(1);
    await expect(row1).toContainText('bob.unclaimed@example.com');
    await expect(row1).toContainText('Bob Unclaimed');
    await expect(row1).toContainText('No'); // No profile
    await expect(row1).toContainText('Feb 20, 2024');

    const row2 = tableRows.nth(2);
    await expect(row2).toContainText('alice.unclaimed@example.com');
    await expect(row2).toContainText('Alice Unclaimed');
    await expect(row2).toContainText('Yes'); // Has profile
    await expect(row2).toContainText('Jan 15, 2024');

    // === Verify View Links ===
    await expect(row0.getByRole('link', { name: 'View' })).toBeVisible();
    await expect(row1.getByRole('link', { name: 'View' })).toBeVisible();
    await expect(row2.getByRole('link', { name: 'View' })).toBeVisible();

    // === Sort by Name (Ascending) ===
    await nameHeader.click();
    await expect(nameHeader).toContainText('↑');

    // Alphabetical: Alice, Bob, Charlie
    await expect(tableRows.nth(0)).toContainText('Alice Unclaimed');
    await expect(tableRows.nth(1)).toContainText('Bob Unclaimed');
    await expect(tableRows.nth(2)).toContainText('Charlie Unclaimed');

    // === Sort by Name (Descending) ===
    await nameHeader.click();
    await expect(nameHeader).toContainText('↓');
    await expect(tableRows.nth(0)).toContainText('Charlie Unclaimed');
    await expect(tableRows.nth(1)).toContainText('Bob Unclaimed');
    await expect(tableRows.nth(2)).toContainText('Alice Unclaimed');

    // === Sort by Email ===
    await emailHeader.click();
    await expect(emailHeader).toContainText('↑');
    // Alphabetical: alice, bob, charlie
    await expect(tableRows.nth(0)).toContainText('alice.unclaimed@example.com');
    await expect(tableRows.nth(1)).toContainText('bob.unclaimed@example.com');
    await expect(tableRows.nth(2)).toContainText('charlie.unclaimed@example.com');

    // === Sort by Has Profile ===
    await hasProfileHeader.click();
    await expect(hasProfileHeader).toContainText('↑');
    // Profiles with slugs first
    await expect(tableRows.nth(0)).toContainText('Yes');
    await expect(tableRows.nth(2)).toContainText('No');
  });

  test('handles API error with user-friendly message', async ({ authenticatedAdminPage }) => {
    // Mock error responses
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/api/admin/members/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ members: [], total: 0 }),
        });
        return;
      }

      if (url.includes('/api/admin/unclaimed-profiles/') && method === 'GET') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Internal server error' }),
        });
        return;
      }

      await route.continue();
    });

    const adminUsersPage = new AdminUsersPage(authenticatedAdminPage);
    await adminUsersPage.goto();

    // === Error Message Displayed ===
    await expect(authenticatedAdminPage.getByText('Failed to load unclaimed profiles')).toBeVisible({
      timeout: 5000,
    });

    // === Page Structure Still Visible ===
    await expect(adminUsersPage.pageHeading).toBeVisible();
    await expect(adminUsersPage.pageHeading).toHaveText('User Management');
  });

  test('admin views unclaimed profile details with proper data display', async ({
    authenticatedAdminPage,
  }) => {
    const mockProfile = mockUnclaimedProfiles[0];

    // Mock GET endpoint
    await authenticatedAdminPage.route('**/api/admin/unclaimed-profiles/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (
        url.includes('/api/admin/unclaimed-profiles/alice.unclaimed@example.com') &&
        method === 'GET'
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProfile),
        });
        return;
      }

      await route.continue();
    });

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('alice.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Verify page structure ===
    await expect(unclaimedProfilePage.pageHeading).toBeVisible();
    await expect(unclaimedProfilePage.sectionHeading).toBeVisible();
    await expect(unclaimedProfilePage.membershipHeading).toBeVisible();

    // === Verify profile data ===
    await expect(unclaimedProfilePage.nameValue).toContainText('Alice Unclaimed');
    await expect(unclaimedProfilePage.emailValue).toContainText('alice.unclaimed@example.com');
    await expect(unclaimedProfilePage.hasProfileValue).toContainText('View Profile');

    // === Verify membership details ===
    await expect(unclaimedProfilePage.subscriptionStartValue).toContainText('Jan 15, 2024');
    await expect(unclaimedProfilePage.lastPaymentValue).toContainText('Jan 15, 2024');
    await expect(unclaimedProfilePage.nextPaymentValue).toContainText('Jan 15, 2025');

    // === Verify invitation email status ===
    await expect(unclaimedProfilePage.invitationEmailValue).toContainText('Sent');
    await expect(unclaimedProfilePage.invitationEmailValue).toContainText('Jan 16, 2024');

    // === Verify send invitation button is disabled (already sent) ===
    await expect(unclaimedProfilePage.sendInvitationButton).toBeDisabled();
    await expect(unclaimedProfilePage.sendInvitationButton).toContainText(
      'Invitation Already Sent',
    );
  });

  test('admin views unclaimed profile without invitation sent and can send invitation', async ({
    authenticatedAdminPage,
  }) => {
    const mockProfile = mockUnclaimedProfiles[1]; // Bob - no invitation sent

    // Mock GET and POST endpoints
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // GET profile details
      if (
        url.includes('/api/admin/unclaimed-profiles/bob.unclaimed@example.com') &&
        method === 'GET'
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProfile),
        });
        return;
      }

      // POST send invitation (simulating the action - actual endpoint depends on implementation)
      if (url.includes('/api/admin/members/') && url.includes('/send-invitation') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      await route.continue();
    });

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('bob.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Verify profile data ===
    await expect(unclaimedProfilePage.nameValue).toContainText('Bob Unclaimed');
    await expect(unclaimedProfilePage.emailValue).toContainText('bob.unclaimed@example.com');

    // === Verify no profile link ===
    await expect(unclaimedProfilePage.hasProfileValue).toContainText('No');

    // === Verify invitation status ===
    await expect(unclaimedProfilePage.invitationEmailValue).toContainText('Not Sent');

    // === Verify send invitation button is enabled ===
    await expect(unclaimedProfilePage.sendInvitationButton).toBeEnabled();
    await expect(unclaimedProfilePage.sendInvitationButton).toContainText('Send Invitation');

    // === Click send invitation (note: actual API endpoint may differ) ===
    // This is a placeholder - adjust based on actual implementation
    await unclaimedProfilePage.sendInvitation();

    // Verify button shows processing state
    await expect(unclaimedProfilePage.sendInvitationButton).toContainText(/Processing|Invitation Already Sent/);
  });

  test('handles profile not found error', async ({ authenticatedAdminPage }) => {
    // Mock 404 response
    await authenticatedAdminPage.route('**/api/admin/unclaimed-profiles/**', async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Unclaimed profile not found' }),
      });
    });

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('nonexistent@example.com');

    // === Verify error message ===
    await expect(unclaimedProfilePage.errorMessage).toBeVisible({ timeout: 5000 });
    await expect(unclaimedProfilePage.errorMessage).toContainText('Failed to load');

    // === Verify details are not shown ===
    await expect(unclaimedProfilePage.sectionHeading).not.toBeVisible();
  });

  test('displays profile with failed invitation status', async ({ authenticatedAdminPage }) => {
    const profileWithFailedInvitation: ApiUnclaimedProfileResponse = {
      email: 'failed.invitation@example.com',
      name: 'Failed Invitation',
      subscriptionStart: '2024-04-01T10:00:00.000Z',
      lastPayment: '2024-04-01T10:00:00.000Z',
      nextPayment: '2025-04-01T10:00:00.000Z',
      invitationEmailStatus: 'failed',
      invitationEmailError: 'Email service temporarily unavailable',
    };

    await authenticatedAdminPage.route('**/api/admin/unclaimed-profiles/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(profileWithFailedInvitation),
      });
    });

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('failed.invitation@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Verify failed invitation status ===
    await expect(unclaimedProfilePage.invitationEmailValue).toContainText('Failed');
    await expect(unclaimedProfilePage.invitationEmailValue).toContainText(
      'Email service temporarily unavailable',
    );

    // === Verify send invitation button is enabled (can retry) ===
    await expect(unclaimedProfilePage.sendInvitationButton).toBeEnabled();
  });
});
