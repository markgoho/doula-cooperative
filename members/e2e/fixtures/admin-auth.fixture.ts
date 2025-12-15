import { test as base, type Page } from '@playwright/test';
import {
  createAuthUser,
  createMemberDocument,
  clearAllEmulatorData,
  type MockUser,
  type MockMemberDocument,
} from './firebase-mocks';

/**
 * Default admin test user for authenticated admin fixtures.
 * Uses webmaster@doulacooperative.com which automatically receives admin
 * custom claims via the setAutoAdminOnUserCreated Cloud Function trigger.
 */
export const defaultAdminUser: MockUser = {
  uid: '',
  email: 'webmaster@doulacooperative.com',
  displayName: 'Admin User',
  emailVerified: true,
  password: 'test1234',
};

/**
 * Default admin member document template.
 */
export const defaultAdminMemberDocument: Omit<MockMemberDocument, 'uid'> = {
  email: 'webmaster@doulacooperative.com',
  name: 'Admin User',
  createdAt: { seconds: 1_704_067_200, nanoseconds: 0 },
  subscriptionStart: { seconds: 1_704_067_200, nanoseconds: 0 },
  membershipActive: true,
  newsletterSubscribed: false,
};

interface AdminAuthFixtures {
  authenticatedAdminPage: Page;
  adminUser: MockUser;
  adminMemberDocument: Omit<MockMemberDocument, 'uid'>;
}

/**
 * Extended Playwright test fixture with pre-authenticated admin user.
 *
 * Similar to auth.fixture but creates a user with admin custom claims.
 * Provides an authenticated page ready at the /admin/users page.
 *
 * Setup (before each test):
 * - Clears all emulator data (Auth + Firestore)
 * - Creates test user in Auth emulator with webmaster@doulacooperative.com email
 * - setAutoAdminOnUserCreated trigger automatically grants admin custom claim
 * - Creates member document with test data
 * - Navigates to /sign-in and completes authentication
 * - Navigates to /admin/users
 *
 * Teardown (after each test):
 * - Clears all emulator data
 *
 * @example
 * test('admin can view users', async ({ authenticatedAdminPage }) => {
 *   // User is already signed in with admin privileges and on /admin/users
 *   await expect(authenticatedAdminPage).toHaveURL('/admin/users');
 * });
 *
 * @example
 * // Custom admin test data
 * test.use({
 *   adminMemberDocument: {
 *     email: 'custom-admin@example.com',
 *     name: 'Custom Admin',
 *     membershipActive: true,
 *   },
 * });
 */
export const test = base.extend<AdminAuthFixtures>({
  // eslint-disable-next-line no-empty-pattern -- Playwright fixture requires object destructuring
  adminUser: async ({}, use) => {
    await use(defaultAdminUser);
  },

  // eslint-disable-next-line no-empty-pattern -- Playwright fixture requires object destructuring
  adminMemberDocument: async ({}, use) => {
    await use(defaultAdminMemberDocument);
  },

  authenticatedAdminPage: async ({ page, adminUser, adminMemberDocument }, use) => {
    let uid: string;

    try {
      // Phase 1: Clear emulator data before test
      await clearAllEmulatorData();
    } catch (error) {
      throw new Error(
        `Failed during admin test setup (emulator cleanup): ${(error as Error).message}`,
      );
    }

    try {
      // Phase 2: Create user in Auth emulator
      // The setAutoAdminOnUserCreated trigger automatically sets admin claim
      // for webmaster@doulacooperative.com
      uid = await createAuthUser(adminUser);
    } catch (error) {
      throw new Error(
        `Failed during admin test setup (create auth user): ${(error as Error).message}`,
      );
    }

    // Phase 3: Wait for setAutoAdminOnUserCreated trigger to set admin claims
    // This Cloud Function trigger runs automatically when the user is created
    await new Promise((resolve) => setTimeout(resolve, 1000));

    try {
      // Phase 4: Create member document
      await createMemberDocument({
        ...adminMemberDocument,
        uid,
        email: adminUser.email,
      } as MockMemberDocument);
    } catch (error) {
      throw new Error(
        `Failed during admin test setup (create member document): ${(error as Error).message}`,
      );
    }

    try {
      // Phase 5: Navigate to sign-in and authenticate
      await page.goto('/sign-in');
      await page.getByLabel('Email Address').fill(adminUser.email);
      await page.getByLabel('Password').fill(adminUser.password || 'test1234');
      await page.getByRole('button', { name: 'Sign In' }).click();

      // Wait for redirect to membership page first
      await page.waitForURL('/membership', { timeout: 10_000 });

      // Phase 6: Navigate to admin users page
      await page.goto('/admin/users');
      // Don't wait for networkidle - tests will mock API responses as needed
    } catch (error) {
      throw new Error(
        `Failed during admin test setup (authentication/navigation): ${(error as Error).message}`,
      );
    }

    // Run the actual test
    await use(page);

    // Cleanup after test
    try {
      await clearAllEmulatorData();
    } catch (error) {
      console.error(`Failed to cleanup emulator data after test: ${(error as Error).message}`);
    }
  },
});

export { expect } from '@playwright/test';
