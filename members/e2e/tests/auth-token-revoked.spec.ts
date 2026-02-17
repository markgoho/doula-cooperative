import { expect } from '@playwright/test';
import { test } from '../fixtures/regular-user-auth.fixture';

test.describe('Revoked auth token handling', () => {
  test('redirects to sign-in when API returns 401', async ({ authenticatedUserPage }) => {
    // Mock /api/members/:uid to return 401 (simulates revoked token)
    await authenticatedUserPage.route('**/api/members/*', async (route) => {
      await route.fulfill({
        status: 401,
        contentType: 'application/json',
        body: JSON.stringify({
          errorId: 'api_auth_token_revoked',
          errorCode: 'auth/id-token-revoked',
          message: 'Revoked auth token',
        }),
      });
    });

    await authenticatedUserPage.goto('/membership');

    // === Verify redirect to sign-in ===
    await expect(authenticatedUserPage).toHaveURL(/\/sign-in/, { timeout: 10_000 });
  });
});
