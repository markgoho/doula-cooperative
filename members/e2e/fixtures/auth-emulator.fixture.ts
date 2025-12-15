import { test as base, type Page } from '@playwright/test';

/**
 * Test user credentials that must exist in the Auth emulator seed data.
 *
 * To create the seed data:
 * 1. Start emulators: firebase emulators:start --only auth
 * 2. Create users via Auth emulator UI at http://localhost:4000/auth
 * 3. Export: firebase emulators:export ./e2e/auth-export
 *
 * Required users:
 * - webmaster@doulacooperative.com (admin)
 */
export const adminCredentials = {
  email: 'webmaster@doulacooperative.com',
  password: 'test1234',
} as const;

interface AuthEmulatorFixtures {
  authenticatedAdminPage: Page;
}

/**
 * Extended Playwright test fixture with pre-authenticated admin user.
 *
 * Uses the Firebase Auth emulator with seeded user data.
 * API calls are NOT mocked by this fixture - tests should set up their own
 * API mocks using page.route() before navigating to pages that make API calls.
 *
 * Setup (before each test):
 * - Navigates to /sign-in
 * - Signs in with webmaster@doulacooperative.com credentials
 * - Waits for redirect to /membership
 *
 * Tests are responsible for:
 * - Setting up API mocks via page.route() for any API calls
 * - Navigating to the page they want to test
 *
 * @example
 * test('admin can view users', async ({ authenticatedAdminPage }) => {
 *   // Set up API mocks BEFORE navigating
 *   await authenticatedAdminPage.route('** /api/admin/members/', async (route) => {
 *     await route.fulfill({
 *       status: 200,
 *       contentType: 'application/json',
 *       body: JSON.stringify({ members: [], total: 0 }),
 *     });
 *   });
 *
 *   // Now navigate
 *   await authenticatedAdminPage.goto('/admin/users');
 *   await expect(authenticatedAdminPage).toHaveURL('/admin/users');
 * });
 */
export const test = base.extend<AuthEmulatorFixtures>({
  authenticatedAdminPage: async ({ page }, use) => {
    // Navigate to sign-in and authenticate against Auth emulator
    await page.goto('/sign-in');
    await page.getByLabel('Email Address').fill(adminCredentials.email);
    await page.getByLabel('Password').fill(adminCredentials.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect to membership page (confirms auth succeeded)
    await page.waitForURL('/membership', { timeout: 10_000 });

    // Run the actual test
    await use(page);

    // No cleanup needed - Auth emulator uses seeded data that persists
  },
});
