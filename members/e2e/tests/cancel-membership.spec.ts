import { test } from '../fixtures/regular-user-auth.fixture';
import { expect } from '@playwright/test';
import type { ApiMemberResponse } from '../../src/app/api-types/members-api.types';

/**
 * E2E test for member self-service cancel membership flow.
 * Uses regular-user-auth.fixture for non-admin user.
 *
 * Mocks:
 * - GET /api/members/:memberId (provides member data with active Stripe subscription)
 * - POST /api/members/:memberId/membership/cancel (cancellation endpoint)
 */

const mockActiveStripeMember: ApiMemberResponse = {
  uid: 'test-user-uid',
  email: 'test-user@doulacooperative.com',
  name: 'Test User',
  createdAt: '2024-01-01T00:00:00.000Z',
  isAdmin: false,
  subscriptionStart: '2024-01-15T00:00:00.000Z',
  membershipActive: true,
  stripeCustomerId: 'cus_test123',
  stripeSubscriptionId: 'sub_test456',
  subscriptionStatus: 'active',
  lastPayment: '2025-02-15T00:00:00.000Z',
  nextPayment: '2025-03-15T00:00:00.000Z',
  slug: 'test-user',
};

test.describe('Cancel Membership', () => {
  test('member cancels their Stripe subscription through confirmation dialog', async ({
    authenticatedUserPage,
  }) => {
    // Mutable mock so we can update it after cancellation
    let currentMember = { ...mockActiveStripeMember };

    // Mock GET /api/members/:memberId
    await authenticatedUserPage.route('**/api/members/*', async (route) => {
      const url = route.request().url();

      // Skip cancel endpoint (handled separately)
      if (url.includes('/membership/cancel')) {
        await route.continue();
        return;
      }

      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(currentMember),
          })
        : route.continue());
    });

    // Mock POST /api/members/:memberId/membership/cancel
    let cancelCalled = false;
    await authenticatedUserPage.route('**/api/members/*/membership/cancel', async (route) => {
      if (route.request().method() === 'POST') {
        cancelCalled = true;

        // Update mock to reflect canceled state for subsequent GET requests
        currentMember = {
          ...currentMember,
          subscriptionStatus: 'canceled',
        };

        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            member: currentMember,
          }),
        });
      } else {
        await route.continue();
      }
    });

    // Navigate to membership page
    await authenticatedUserPage.goto('/membership');

    // === Verify Cancel Button is Visible ===
    const cancelButton = authenticatedUserPage.getByRole('button', { name: 'Cancel Membership' });
    await expect(cancelButton).toBeVisible();

    // === Click Cancel and Verify Confirmation Dialog ===
    await cancelButton.click();

    const confirmDialog = authenticatedUserPage.getByRole('dialog');
    await expect(confirmDialog).toBeVisible();
    await expect(
      authenticatedUserPage.getByText(
        /Are you sure you want to cancel your membership\? You will remain an active member until your current billing period ends/,
      ),
    ).toBeVisible();

    // === Confirm Cancellation ===
    const confirmButton = confirmDialog.getByRole('button', { name: 'Cancel Membership' });
    await confirmButton.click();

    // === Verify API Was Called ===
    await expect.poll(() => cancelCalled).toBe(true);

    // === Verify UI Updates ===
    await expect(confirmDialog).not.toBeVisible();

    // Cancellation notice should appear
    await expect(
      authenticatedUserPage.getByText(
        /Membership cancellation scheduled.*remain an active member until your current billing period ends/,
      ),
    ).toBeVisible();
  });
});
