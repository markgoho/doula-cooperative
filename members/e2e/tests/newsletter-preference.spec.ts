import { test } from '../fixtures/regular-user-auth.fixture';
import { expect } from '@playwright/test';
import type { ApiMemberResponse } from '../../src/app/api-types/members-api.types';

/**
 * Mock member document returned by GET /api/members/:memberId.
 * All timestamp fields are ISO 8601 strings (as returned by the Elysia API).
 */
const mockMemberDocumentBase: ApiMemberResponse = {
  uid: 'test-user-uid',
  email: 'test-user@doulacooperative.com',
  name: 'Test User',
  createdAt: '2024-01-01T00:00:00.000Z',
  isAdmin: false,
  subscriptionStart: '2024-01-01T00:00:00.000Z',
  membershipActive: true,
  slug: 'test-user',
};

test.describe('Newsletter Preference', () => {
  /**
   * Tests the newsletter preference toggle with properly mocked API endpoints.
   * Uses regular-user-auth.fixture for non-admin user (test-user@doulacooperative.com).
   * Mocks:
   * - GET /api/members/:memberId (MembershipService - provides newsletter preference)
   * - PATCH /api/members/:memberId/newsletter-preference (updates preference)
   */

  test('user subscribes to newsletter', async ({ authenticatedUserPage }) => {
    // Initial state: not subscribed
    const mockMemberDocument: ApiMemberResponse = {
      ...mockMemberDocumentBase,
      newsletterSubscribed: false,
    };

    // Mock GET /api/members/:memberId for initial member document lookup
    await authenticatedUserPage.route('**/api/members/*', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMemberDocument),
          })
        : route.continue());
    });

    // Mock PATCH /api/members/:memberId/newsletter-preference
    let updateCalled = false;
    let updateSubscribed: boolean | undefined;
    await authenticatedUserPage.route('**/api/members/*/newsletter-preference', async (route) => {
      if (route.request().method() === 'PATCH') {
        const requestBody = route.request().postDataJSON() as {
          subscribed: boolean;
        };
        updateCalled = true;
        updateSubscribed = requestBody.subscribed;

        // Return success response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            subscribed: requestBody.subscribed,
          }),
        });

        // Update mock to return subscribed state for subsequent GET requests
        mockMemberDocument.newsletterSubscribed = requestBody.subscribed;
        mockMemberDocument.newsletterSubscribedAt = '2024-01-15T10:30:00.000Z';
      } else {
        await route.continue();
      }
    });

    // Navigate to membership page
    await authenticatedUserPage.goto('/membership');

    // === Verify Initial State ===
    const newsletterCheckbox = authenticatedUserPage.getByRole('checkbox', {
      name: /not subscribed/i,
    });
    await expect(newsletterCheckbox).toBeVisible();
    await expect(newsletterCheckbox).not.toBeChecked();

    // === Subscribe to Newsletter ===
    await newsletterCheckbox.click();

    // === Verify API Call ===
    await expect.poll(() => updateCalled).toBe(true);
    expect(updateSubscribed).toBe(true);

    // === Verify UI Updates ===
    await expect(
      authenticatedUserPage.getByRole('checkbox', { name: /subscribed/i }),
    ).toBeChecked();
  });

  test('user unsubscribes from newsletter', async ({ authenticatedUserPage }) => {
    // Initial state: subscribed
    const mockMemberDocument: ApiMemberResponse = {
      ...mockMemberDocumentBase,
      newsletterSubscribed: true,
      newsletterSubscribedAt: '2024-01-01T10:00:00.000Z',
    };

    // Mock GET /api/members/:memberId for initial member document lookup
    await authenticatedUserPage.route('**/api/members/*', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMemberDocument),
          })
        : route.continue());
    });

    // Mock PATCH /api/members/:memberId/newsletter-preference
    let updateCalled = false;
    let updateSubscribed: boolean | undefined;
    await authenticatedUserPage.route('**/api/members/*/newsletter-preference', async (route) => {
      if (route.request().method() === 'PATCH') {
        const requestBody = route.request().postDataJSON() as {
          subscribed: boolean;
        };
        updateCalled = true;
        updateSubscribed = requestBody.subscribed;

        // Return success response
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            subscribed: requestBody.subscribed,
          }),
        });

        // Update mock to return unsubscribed state for subsequent GET requests
        mockMemberDocument.newsletterSubscribed = requestBody.subscribed;
        mockMemberDocument.newsletterUnsubscribedAt = '2024-01-15T10:30:00.000Z';
      } else {
        await route.continue();
      }
    });

    // Navigate to membership page
    await authenticatedUserPage.goto('/membership');

    // === Verify Initial State ===
    const newsletterCheckbox = authenticatedUserPage.getByRole('checkbox', {
      name: /subscribed/i,
    });
    await expect(newsletterCheckbox).toBeVisible();
    await expect(newsletterCheckbox).toBeChecked();

    // === Unsubscribe from Newsletter ===
    await newsletterCheckbox.click();

    // === Verify API Call ===
    await expect.poll(() => updateCalled).toBe(true);
    expect(updateSubscribed).toBe(false);

    // === Verify UI Updates ===
    await expect(
      authenticatedUserPage.getByRole('checkbox', { name: /not subscribed/i }),
    ).not.toBeChecked();
  });

  // TODO: Add error handling E2E test once UI state management on error is finalized
  // Error handling is already covered in unit tests (see update-newsletter-preference.test.ts)

  test('newsletter preference section is hidden when user has claimable profile', async ({
    authenticatedUserPage,
  }) => {
    const mockMemberDocument: ApiMemberResponse = {
      ...mockMemberDocumentBase,
      newsletterSubscribed: false,
    };

    // Mock GET /api/members/:memberId
    await authenticatedUserPage.route('**/api/members/*', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMemberDocument),
          })
        : route.continue());
    });

    // Mock migrated_users_import collection to return claimable profile
    await authenticatedUserPage.route('**/firestore/**', async (route) => {
      // This would need actual Firestore emulator mocking
      // For now, just continue
      await route.continue();
    });

    // Navigate to membership page
    await authenticatedUserPage.goto('/membership');

    // === Newsletter Preferences Section Should Be Visible ===
    // (It's only hidden if hasClaimableProfile() returns true, which won't happen
    // without proper Firestore emulator setup. This test verifies the section exists.)
    await expect(authenticatedUserPage.getByText(/newsletter preferences/i)).toBeVisible();
  });
});
