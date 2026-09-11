import { test as base, type Page } from '@playwright/test';

/**
 * Regular (non-admin) test user credentials for Auth emulator.
 * This user must be added to the auth export data.
 *
 * To add this user:
 * 1. Start emulators: firebase emulators:start --only auth
 * 2. Go to Auth emulator UI at http://localhost:4000/auth
 * 3. Add user with email test-user@doulacooperative.com, password test1234
 * 4. Export: firebase emulators:export ./e2e/auth-export
 */
export const regularUserCredentials = {
  email: 'test-user@doulacooperative.com',
  password: 'test1234',
} as const;

interface RegularUserAuthFixtures {
  authenticatedUserPage: Page;
}

/**
 * Extended Playwright test fixture with pre-authenticated regular user.
 *
 * Uses the Firebase Auth emulator with seeded non-admin user data.
 * API calls are NOT mocked by this fixture - tests must set up their own
 * API mocks using page.route() before navigating to pages that make API calls.
 *
 * Setup (before each test):
 * - Navigates to /sign-in
 * - Signs in with test-user@doulacooperative.com credentials
 * - Waits for redirect to /membership
 *
 * Tests are responsible for:
 * - Setting up API mocks via page.route() for any API calls
 * - Navigating to the page they want to test
 * - Mocking member document data via Firestore REST API if needed
 *
 */
export const test = base.extend<RegularUserAuthFixtures>({
  authenticatedUserPage: async ({ page }, use) => {
    // Navigate to sign-in and authenticate against Auth emulator
    await page.goto('/sign-in');
    await page.getByLabel('Email Address').fill(regularUserCredentials.email);
    await page.getByLabel('Password').fill(regularUserCredentials.password);
    await page.getByRole('button', { name: 'Sign In' }).click();

    // Wait for redirect to membership page (confirms auth succeeded)
    await page.waitForURL('/membership', { timeout: 10_000 });

    // Run the actual test
    await use(page);

    // No cleanup needed - Auth emulator uses seeded data that persists
  },
});
