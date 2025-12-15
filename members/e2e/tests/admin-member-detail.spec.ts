import { test } from '../fixtures/auth-emulator.fixture';
import { expect } from '@playwright/test';
import type { ApiMemberResponse } from '../../src/app/admin/api-types/admin-members-api.types';
import { AdminMemberDetailPage } from '../pages/admin-member-detail.page';

/**
 * E2E tests for admin member detail page operations
 */
const mockMember: ApiMemberResponse = {
  uid: 'test-member-123',
  email: 'test.member@example.com',
  name: 'Test Member',
  createdAt: '2024-01-15T10:30:00.000Z',
  membershipActive: true,
  subscriptionStart: '2024-01-15T10:30:00.000Z',
  membershipExpiresAt: '2025-01-15T10:30:00.000Z',
};

test.describe('Admin Member Detail Page', () => {
  test('admin views member details with proper data display', async ({ authenticatedAdminPage }) => {
    // Mock GET endpoint
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/api/admin/members/test-member-123') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMember),
        });
        return;
      }

      await route.continue();
    });

    const memberDetailPage = new AdminMemberDetailPage(authenticatedAdminPage);
    await memberDetailPage.goto('test-member-123');
    await memberDetailPage.waitForMemberDetails();

    // Verify page structure
    await expect(memberDetailPage.pageHeading).toBeVisible();

    // Verify member data using accessible selectors
    await expect(memberDetailPage.nameValue).toContainText('Test Member');
    await expect(memberDetailPage.emailValue).toContainText('test.member@example.com');
    await expect(memberDetailPage.uidValue).toContainText('test-member-123');
    await expect(memberDetailPage.membershipStatus).toContainText('Active');

    // Verify delete button is available
    await expect(memberDetailPage.deleteButton).toBeVisible();
  });

  test('admin successfully deletes a user', async ({ authenticatedAdminPage }) => {
    // Mock all API endpoints we need
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // GET single member
      if (url.includes('/api/admin/members/test-member-123') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMember),
        });
        return;
      }

      // DELETE member
      if (url.includes('/api/admin/members/test-member-123') && method === 'DELETE') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
        return;
      }

      // GET members list (for redirect)
      if (url.endsWith('/api/admin/members/') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ members: [], total: 0 }),
        });
        return;
      }

      // Let other requests through
      await route.continue();
    });

    const memberDetailPage = new AdminMemberDetailPage(authenticatedAdminPage);
    await memberDetailPage.goto('test-member-123');
    await memberDetailPage.waitForMemberDetails();

    // Click delete button
    await memberDetailPage.deleteUser();

    // Verify redirect to users list
    await authenticatedAdminPage.waitForURL('**/admin/users');
    await expect(authenticatedAdminPage.getByRole('heading', { name: 'User Management' })).toBeVisible();
  });

  test('admin cancels user deletion', async ({ authenticatedAdminPage }) => {
    // Mock GET endpoint only (no DELETE since we're canceling)
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/api/admin/members/test-member-123') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMember),
        });
        return;
      }

      await route.continue();
    });

    const memberDetailPage = new AdminMemberDetailPage(authenticatedAdminPage);
    await memberDetailPage.goto('test-member-123');
    await memberDetailPage.waitForMemberDetails();

    // Click delete button
    await memberDetailPage.deleteButton.click();

    // Verify confirm dialog appears
    await expect(memberDetailPage.confirmDialog).toBeVisible();
    await expect(memberDetailPage.confirmMessage).toContainText(
      'Are you sure you want to permanently delete this user account',
    );

    // Cancel the action
    await memberDetailPage.cancelAction();

    // Verify dialog is closed and we're still on the detail page
    await expect(memberDetailPage.confirmDialog).not.toBeVisible();
    await expect(authenticatedAdminPage).toHaveURL(/\/admin\/users\/member\/test-member-123/);
    await expect(memberDetailPage.pageHeading).toBeVisible();
  });

  test('handles deletion error gracefully', async ({ authenticatedAdminPage }) => {
    // Mock GET and failing DELETE
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/api/admin/members/test-member-123') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMember),
        });
        return;
      }

      if (url.includes('/api/admin/members/test-member-123') && method === 'DELETE') {
        await route.fulfill({
          status: 500,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Failed to delete user' }),
        });
        return;
      }

      await route.continue();
    });

    const memberDetailPage = new AdminMemberDetailPage(authenticatedAdminPage);
    await memberDetailPage.goto('test-member-123');
    await memberDetailPage.waitForMemberDetails();

    // Click delete and confirm
    await memberDetailPage.deleteUser();

    // Verify error message appears (using getByText for specific error content)
    await expect(authenticatedAdminPage.getByText('Failed to delete user')).toBeVisible();

    // Verify we're still on the detail page (not redirected)
    await expect(authenticatedAdminPage).toHaveURL(/\/admin\/users\/member\/test-member-123/);
    await expect(memberDetailPage.pageHeading).toBeVisible();
  });
});
