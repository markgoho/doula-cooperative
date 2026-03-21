import { test } from '../fixtures/admin-auth.fixture';
import { expect } from '@playwright/test';
import type {
  ApiUnclaimedProfileResponse,
  ApiListUnclaimedProfilesResponse,
} from '../../src/app/admin/api-types/admin-unclaimed-profiles-api.types';
import { AdminUnclaimedProfileDetailPage } from '../pages/admin-unclaimed-profile-detail.page';
import { AdminUnclaimedPage } from '../pages/admin-unclaimed.page';

/**
 * Mock data for testing admin unclaimed profiles.
 * Uses production API types with ISO 8601 timestamp strings (matching Elysia API).
 */
const mockUnclaimedProfiles: ApiUnclaimedProfileResponse[] = [
  {
    email: 'alice.unclaimed@example.com',
    name: 'Alice Unclaimed',
    subscriptionStart: '2024-01-15T10:30:00.000Z',
    lastPayment: '2024-01-15T10:30:00.000Z',
    nextPayment: '2025-01-15T10:30:00.000Z',
    slug: 'alice-unclaimed',
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
    // Mock list unclaimed profiles (includes query params like ?limit=50&offset=0)
    // Use regex to match list endpoint but not detail endpoint (which has email in path)
    await authenticatedAdminPage.route(/\/api\/admin\/unclaimed-profiles(\?|$)/, async (route) => {
      const method = route.request().method();
      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockListUnclaimedProfilesResponse),
        });
        return;
      }
      await route.continue();
    });

    const adminUnclaimedPage = new AdminUnclaimedPage(authenticatedAdminPage);
    await adminUnclaimedPage.goto();
    await adminUnclaimedPage.waitForProfilesTable();

    // === Page Structure and Stats ===
    await expect(adminUnclaimedPage.pageHeading).toBeVisible();
    await expect(adminUnclaimedPage.pageHeading).toHaveText('Unclaimed Profiles');

    // Verify header stats
    const headerStats = authenticatedAdminPage.locator('.header-stats');
    await expect(headerStats).toContainText('Total Unclaimed: 3');

    // === Unclaimed Profiles Table Structure ===
    const unclaimedTable = authenticatedAdminPage.locator('app-unclaimed-profiles-table table');
    await expect(unclaimedTable).toBeVisible();

    // Check table headers
    const nameHeader = unclaimedTable.getByRole('columnheader', { name: /Name/ });
    const emailHeader = unclaimedTable.getByRole('columnheader', { name: /Email/ });
    const hasProfileHeader = unclaimedTable.getByRole('columnheader', { name: /Has Profile/ });
    const nextPaymentHeader = unclaimedTable.getByRole('columnheader', { name: /Next Payment/ });

    await expect(nameHeader).toBeVisible();
    await expect(emailHeader).toBeVisible();
    await expect(hasProfileHeader).toBeVisible();
    await expect(nextPaymentHeader).toBeVisible();

    // === Initial Data Display (default sort: next payment descending) ===
    const tableRows = unclaimedTable.locator('tbody tr');
    await expect(tableRows).toHaveCount(3);

    // Charlie (Mar 10, 2025) latest, Bob (Feb 20, 2025) middle, Alice (Jan 15, 2025) earliest
    const row0 = tableRows.nth(0);
    await expect(row0).toContainText('charlie.unclaimed@example.com');
    await expect(row0).toContainText('Charlie Unclaimed');
    await expect(row0).toContainText('Yes'); // Has profile
    await expect(row0).toContainText('Mar 10, 2025');

    const row1 = tableRows.nth(1);
    await expect(row1).toContainText('bob.unclaimed@example.com');
    await expect(row1).toContainText('Bob Unclaimed');
    await expect(row1).toContainText('No'); // No profile
    await expect(row1).toContainText('Feb 20, 2025');

    const row2 = tableRows.nth(2);
    await expect(row2).toContainText('alice.unclaimed@example.com');
    await expect(row2).toContainText('Alice Unclaimed');
    await expect(row2).toContainText('Yes'); // Has profile
    await expect(row2).toContainText('Jan 15, 2025');

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

  test('admin views unclaimed profile details with proper data display', async ({
    authenticatedAdminPage,
  }) => {
    const mockProfile = mockUnclaimedProfiles[0]!;

    // Mock GET single profile (email in path is URL-encoded)
    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/alice.unclaimed@example.com',
      async (route) => {
        await (route.request().method() === 'GET'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(mockProfile),
            })
          : route.continue());
      },
    );

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('alice.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Verify page structure ===
    await expect(unclaimedProfilePage.pageHeading).toBeVisible();
    await expect(unclaimedProfilePage.sectionHeading).toBeVisible();

    // === Verify profile data (ad-hoc selectors) ===
    await expect(authenticatedAdminPage.getByText('Alice Unclaimed')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('alice.unclaimed@example.com')).toBeVisible();
    await expect(authenticatedAdminPage.getByRole('link', { name: 'View Profile' })).toBeVisible();

    // === Verify membership details (ad-hoc selectors) ===
    await expect(authenticatedAdminPage.getByText('Jan 15, 2024').first()).toBeVisible();
    await expect(authenticatedAdminPage.getByText('Jan 15, 2025')).toBeVisible();

  });


  test('handles profile not found error', async ({ authenticatedAdminPage }) => {
    // Mock 404 response for specific profile
    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/nonexistent@example.com',
      async (route) => {
        await (route.request().method() === 'GET'
          ? route.fulfill({
              status: 404,
              contentType: 'application/json',
              body: JSON.stringify({ error: 'Unclaimed profile not found' }),
            })
          : route.continue());
      },
    );

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('nonexistent@example.com');

    // === Verify error message ===
    await expect(unclaimedProfilePage.errorMessage).toBeVisible({ timeout: 5000 });

    // === Verify details are not shown ===
    await expect(unclaimedProfilePage.sectionHeading).not.toBeVisible();
  });

  test('admin deletes unclaimed profile with confirmation', async ({ authenticatedAdminPage }) => {
    const mockProfile = mockUnclaimedProfiles[1]!; // Bob

    let deleteRequestMade = false;

    // Mock GET and DELETE
    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/bob.unclaimed@example.com',
      async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockProfile),
          });
          return;
        }
        if (method === 'DELETE') {
          deleteRequestMade = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
          return;
        }
        await route.continue();
      },
    );

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('bob.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Verify delete button is visible in danger zone ===
    await expect(unclaimedProfilePage.deleteProfileButton).toBeVisible();

    // === Click delete button to open confirmation dialog ===
    await unclaimedProfilePage.deleteProfileButton.click();

    // === Verify confirmation dialog is visible ===
    const dialog = authenticatedAdminPage.locator('dialog[open]');
    await expect(dialog).toBeVisible();
    await expect(dialog.getByText(/confirm deletion/i)).toBeVisible();

    // === Click confirm button in dialog ===
    await dialog.getByRole('button', { name: /delete profile/i }).click();

    // === Verify DELETE request was made ===
    await authenticatedAdminPage.waitForTimeout(500); // Allow time for navigation
    expect(deleteRequestMade).toBe(true);

    // === Verify navigation to unclaimed profiles list ===
    await expect(authenticatedAdminPage).toHaveURL(/\/admin\/unclaimed$/);
  });

  test('admin cancels profile deletion when rejecting confirmation', async ({
    authenticatedAdminPage,
  }) => {
    const mockProfile = mockUnclaimedProfiles[1]!; // Bob

    let deleteRequestMade = false;

    // Mock GET and DELETE
    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/bob.unclaimed@example.com',
      async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockProfile),
          });
          return;
        }
        if (method === 'DELETE') {
          deleteRequestMade = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
          return;
        }
        await route.continue();
      },
    );

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('bob.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Click delete button to open confirmation dialog ===
    await unclaimedProfilePage.deleteProfileButton.click();

    // === Verify confirmation dialog is visible ===
    const dialog = authenticatedAdminPage.locator('dialog[open]');
    await expect(dialog).toBeVisible();

    // === Click cancel button in dialog ===
    await dialog.getByRole('button', { name: /cancel/i }).click();

    // === Verify DELETE request was NOT made ===
    await authenticatedAdminPage.waitForTimeout(500);
    expect(deleteRequestMade).toBe(false);

    // === Verify dialog is closed ===
    await expect(dialog).not.toBeVisible();

    // === Verify still on detail page ===
    await expect(authenticatedAdminPage).toHaveURL(/\/admin\/unclaimed\/bob.unclaimed@example.com/);
    await expect(unclaimedProfilePage.sectionHeading).toBeVisible();
  });

  test('handles profile deletion error with error message', async ({ authenticatedAdminPage }) => {
    const mockProfile = mockUnclaimedProfiles[1]!; // Bob

    // Mock GET and DELETE with error response
    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/bob.unclaimed@example.com',
      async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockProfile),
          });
          return;
        }
        if (method === 'DELETE') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Failed to delete profile' }),
          });
          return;
        }
        await route.continue();
      },
    );

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('bob.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Click delete button to open confirmation dialog ===
    await unclaimedProfilePage.deleteProfileButton.click();

    // === Verify confirmation dialog is visible ===
    const dialog = authenticatedAdminPage.locator('dialog[open]');
    await expect(dialog).toBeVisible();

    // === Click confirm button in dialog ===
    await dialog.getByRole('button', { name: /delete profile/i }).click();

    // === Verify error message appears ===
    await expect(authenticatedAdminPage.getByText(/Failed to delete|error deleting/i)).toBeVisible({
      timeout: 5000,
    });

    // === Verify still on detail page (deletion failed) ===
    await expect(authenticatedAdminPage).toHaveURL(/\/admin\/unclaimed\/bob.unclaimed@example.com/);
  });


  test('update email button visible for unclaimed profile', async ({
    authenticatedAdminPage,
  }) => {
    const bobProfile = mockUnclaimedProfiles[1]!;

    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/bob.unclaimed@example.com',
      async (route) => {
        await (route.request().method() === 'GET'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(bobProfile),
            })
          : route.continue());
      },
    );

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('bob.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    await expect(unclaimedProfilePage.updateEmailButton).toBeVisible();
  });

  test('admin updates email successfully', async ({
    authenticatedAdminPage,
  }) => {
    const mockProfile = mockUnclaimedProfiles[1]!; // Bob
    let patchRequestMade = false;

    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/bob.unclaimed@example.com',
      async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockProfile),
          });
          return;
        }
        if (method === 'PATCH') {
          patchRequestMade = true;
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true }),
          });
          return;
        }
        await route.continue();
      },
    );

    // Mock the new email profile page (navigation target after success)
    const updatedProfile: ApiUnclaimedProfileResponse = {
      email: 'newbob@example.com',
      name: mockProfile.name,
      subscriptionStart: mockProfile.subscriptionStart,
      lastPayment: mockProfile.lastPayment,
      nextPayment: mockProfile.nextPayment,
    };

    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/newbob@example.com',
      async (route) => {
        if (route.request().method() === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(updatedProfile),
          });
          return;
        }
        await route.continue();
      },
    );

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('bob.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Fill and submit update email form ===
    await unclaimedProfilePage.fillAndSubmitUpdateEmail('newbob@example.com');

    // === Verify success message appears ===
    await expect(unclaimedProfilePage.successMessage).toBeVisible({ timeout: 5000 });
    await expect(unclaimedProfilePage.successMessage).toContainText(
      'Email updated to newbob@example.com',
    );

    // === Verify navigated to new email route ===
    await authenticatedAdminPage.waitForURL('**/admin/unclaimed/newbob@example.com', {
      timeout: 5000,
    });

    // === Verify the PATCH was made ===
    expect(patchRequestMade).toBe(true);
  });

  test('handles update email failure with error message', async ({ authenticatedAdminPage }) => {
    const mockProfile = mockUnclaimedProfiles[1]!; // Bob

    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/bob.unclaimed@example.com',
      async (route) => {
        const method = route.request().method();
        if (method === 'GET') {
          await route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockProfile),
          });
          return;
        }
        if (method === 'PATCH') {
          await route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Failed to update email' }),
          });
          return;
        }
        await route.continue();
      },
    );

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('bob.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Fill and submit update email form ===
    await unclaimedProfilePage.fillAndSubmitUpdateEmail('newbob@example.com');

    // === Verify error message appears ===
    await expect(unclaimedProfilePage.errorMessage).toBeVisible({ timeout: 5000 });

    // === Verify still on original page (no navigation) ===
    await expect(authenticatedAdminPage).toHaveURL(
      /\/admin\/unclaimed\/bob\.unclaimed@example\.com/,
    );
  });

  test('admin cancels update email form', async ({ authenticatedAdminPage }) => {
    const mockProfile = mockUnclaimedProfiles[1]!; // Bob

    await authenticatedAdminPage.route(
      '**/api/admin/unclaimed-profiles/bob.unclaimed@example.com',
      async (route) => {
        await (route.request().method() === 'GET'
          ? route.fulfill({
              status: 200,
              contentType: 'application/json',
              body: JSON.stringify(mockProfile),
            })
          : route.continue());
      },
    );

    const unclaimedProfilePage = new AdminUnclaimedProfileDetailPage(authenticatedAdminPage);
    await unclaimedProfilePage.goto('bob.unclaimed@example.com');
    await unclaimedProfilePage.waitForProfileDetails();

    // === Open update email form ===
    await unclaimedProfilePage.updateEmailButton.click();
    await expect(unclaimedProfilePage.updateEmailInput).toBeVisible();
    await expect(unclaimedProfilePage.confirmUpdateButton).toBeVisible();

    // === Cancel ===
    await unclaimedProfilePage.cancelUpdateButton.click();

    // === Verify form is hidden and original button is back ===
    await expect(unclaimedProfilePage.updateEmailInput).not.toBeVisible();
    await expect(unclaimedProfilePage.updateEmailButton).toBeVisible();
  });
});
