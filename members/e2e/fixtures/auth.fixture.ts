import { test as base, type Page } from '@playwright/test';
import {
  createAuthUser,
  createMemberDocument,
  clearAllEmulatorData,
  type MockUser,
  type MockMemberDocument,
} from './firebase-mocks';

/**
 * Default test user for authenticated fixtures.
 * Email/password intentionally use generic test values to avoid confusion
 * with real accounts in development environments.
 */
export const defaultTestUser: MockUser = {
  uid: '', // Will be assigned by Auth emulator during creation
  email: 'test@example.com',
  displayName: 'Test User',
  emailVerified: true,
  password: 'test1234',
};

/**
 * Default member document template.
 * Uses Jan 1, 2024 as a stable reference date for timestamp testing.
 * uid and email will be set to match the created auth user.
 */
export const defaultMemberDocument: Omit<MockMemberDocument, 'uid'> = {
  email: 'test@example.com',
  name: 'Test User',
  createdAt: { seconds: 1_704_067_200, nanoseconds: 0 }, // Jan 1, 2024 00:00:00 UTC
  subscriptionStart: { seconds: 1_704_067_200, nanoseconds: 0 },
  membershipActive: true,
  newsletterSubscribed: false,
};

interface AuthFixtures {
  authenticatedPage: Page;
  testUser: MockUser;
  testMemberDocument: Omit<MockMemberDocument, 'uid'>;
}

/**
 * Extended Playwright test fixture with pre-authenticated Firebase session.
 *
 * Provides an authenticated page that has completed the sign-in flow and
 * is ready at the /membership page.
 *
 * Setup (before each test):
 * - Clears all emulator data (Auth + Firestore)
 * - Creates test user in Auth emulator
 * - Polls for createMemberOnUserCreated trigger to create member document
 * - Overwrites member document with test data
 * - Navigates to /sign-in and completes authentication
 * - Waits for navigation to /membership
 *
 * Teardown (after each test):
 * - Clears all emulator data (cleanup errors are logged but don't fail tests)
 *
 * @example
 * test('my test', async ({ authenticatedPage }) => {
 *   // User is already signed in and on /membership page
 *   await expect(authenticatedPage).toHaveURL('/membership');
 * });
 *
 * @example
 * // Custom test data
 * test.use({
 *   testMemberDocument: {
 *     email: 'custom@example.com',
 *     name: 'Custom User',
 *     membershipActive: false,
 *   },
 * });
 */
export const test = base.extend<AuthFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture requires object destructuring
  testUser: async ({}, use) => {
    await use(defaultTestUser);
  },

  // eslint-disable-next-line no-empty-pattern -- Playwright fixture requires object destructuring
  testMemberDocument: async ({}, use) => {
    await use(defaultMemberDocument);
  },

  authenticatedPage: async ({ page, testUser, testMemberDocument }, use) => {
    let uid: string;

    try {
      // Phase 1: Clear emulator data before test to ensure clean state
      await clearAllEmulatorData();
    } catch (error) {
      throw new Error(
        `Failed during test setup (emulator cleanup phase): ${(error as Error).message}`,
      );
    }

    try {
      // Phase 2: Create user in Auth emulator
      // This triggers createMemberOnUserCreated in Functions emulator
      uid = await createAuthUser(testUser);
    } catch (error) {
      throw new Error(
        `Failed during test setup (create auth user phase): ${(error as Error).message}`,
      );
    }

    // Phase 3: Wait briefly for auth trigger to potentially create member document
    // Note: The auth trigger (createMemberOnUserCreated) uses v1 Firebase Functions
    // which may not fire reliably in emulators. We create/update the document
    // manually in the next phase, so this is just a brief grace period.
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      // Phase 4: Create/update member document with test data
      // This will create the document if the trigger didn't, or update it if it did
      await createMemberDocument({
        ...testMemberDocument,
        uid,
        email: testUser.email,
      } as MockMemberDocument);
    } catch (error) {
      throw new Error(
        `Failed during test setup (create member document phase): ${(error as Error).message}`,
      );
    }

    try {
      // Phase 5: Navigate to sign-in page and authenticate
      await page.goto('/sign-in');
      await page.getByLabel('Email Address').fill(testUser.email);
      await page.getByLabel('Password').fill(testUser.password || 'test1234');
      await page.getByRole('button', { name: 'Sign In' }).click();
      await page.waitForURL('/membership');
    } catch (error) {
      throw new Error(
        `Failed during test setup (authentication phase): ${(error as Error).message}`,
      );
    }

    // Run the actual test
    await use(page);

    // Phase 6: Cleanup after test
    // Don't throw cleanup errors - they shouldn't mask test failures
    try {
      await clearAllEmulatorData();
    } catch (error) {
      console.error(`Failed to cleanup emulator data after test: ${(error as Error).message}`);
    }
  },
});

export { expect } from '@playwright/test';
