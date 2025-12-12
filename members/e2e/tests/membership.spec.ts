import { test as base } from '@playwright/test';
import { test, expect } from '../fixtures/auth.fixture';
import { MembershipPage } from '../pages/membership.page';

test.describe('Membership Page', () => {
  test('member views their account details and signs out', async ({ authenticatedPage }) => {
    const membershipPage = new MembershipPage(authenticatedPage);

    // Wait for page to fully load
    await membershipPage.waitForAccountDetails();

    // Welcome message with user's name
    await expect(membershipPage.welcomeMessage).toContainText('Welcome back, Test User!');

    // Account details section
    await expect(membershipPage.accountDetailsHeading).toBeVisible();
    await expect(membershipPage.fullNameItem).toContainText('Test User');
    await expect(membershipPage.emailItem).toContainText('test@example.com');
    await expect(membershipPage.emailVerifiedItem).toBeVisible();

    // Subscription dates displayed with proper format
    await expect(membershipPage.accountCreatedItem).toBeVisible();
    await expect(membershipPage.accountCreatedItem).toContainText(/\w+ \d+, \d{4}/);
    await expect(membershipPage.subscriptionItem).toBeVisible();
    await expect(membershipPage.subscriptionItem).toContainText(/\w+ \d+, \d{4}/);

    // Newsletter preferences section
    await expect(membershipPage.newsletterHeading).toBeVisible();
    await expect(membershipPage.newsletterToggle).toBeVisible();
    await expect(membershipPage.newsletterStatus).toContainText('Not subscribed');

    // Sign out flow
    await expect(membershipPage.signOutButton).toBeVisible();
    await membershipPage.signOut();
    await expect(authenticatedPage).toHaveURL('/sign-in');
  });
});

test.describe('Membership Page - Active Subscriber', () => {
  test.use({
    testMemberDocument: {
      email: 'test@example.com',
      name: 'Test User',
      createdAt: { seconds: 1_704_067_200, nanoseconds: 0 },
      subscriptionStart: { seconds: 1_704_067_200, nanoseconds: 0 },
      membershipActive: true,
      newsletterSubscribed: true,
      lastPayment: { seconds: 1_733_011_200, nanoseconds: 0 },
      nextPayment: { seconds: 1_735_689_600, nanoseconds: 0 },
    },
  });

  test('active subscriber sees payment info and newsletter subscription', async ({
    authenticatedPage,
  }) => {
    const membershipPage = new MembershipPage(authenticatedPage);

    await membershipPage.waitForAccountDetails();

    // Payment information section
    await expect(membershipPage.paymentHeading).toBeVisible();
    await expect(membershipPage.lastPaymentItem).toBeVisible();
    await expect(membershipPage.lastPaymentItem).toContainText(/\w+ \d+, \d{4}/);
    await expect(membershipPage.nextPaymentItem).toBeVisible();
    await expect(membershipPage.nextPaymentItem).toContainText(/\w+ \d+, \d{4}/);

    // Newsletter shows as subscribed
    await expect(membershipPage.newsletterStatus).toContainText('Subscribed');
    await expect(membershipPage.newsletterToggle).toBeChecked();
  });
});

test.describe('Newsletter Preferences', () => {
  test('member can subscribe to newsletter', async ({ authenticatedPage }) => {
    const membershipPage = new MembershipPage(authenticatedPage);
    await membershipPage.waitForAccountDetails();

    // Verify initially not subscribed
    await expect(membershipPage.newsletterStatus).toContainText('Not subscribed');
    await expect(membershipPage.newsletterToggle).not.toBeChecked();

    // Subscribe to newsletter
    await membershipPage.toggleNewsletter();

    // Wait for update to complete - first wait for updating indicator to appear then disappear
    await expect(membershipPage.newsletterUpdating).toBeHidden({ timeout: 10_000 });

    // Wait for status to change (the Firebase function updates Firestore, then the UI reloads the document)
    await expect(membershipPage.newsletterStatus).not.toContainText('Not subscribed', { timeout: 10_000 });

    // Verify state changed
    await expect(membershipPage.newsletterStatus).toContainText('Subscribed');
    await expect(membershipPage.newsletterToggle).toBeChecked();

    // Reload page and verify persistence
    await authenticatedPage.reload();
    await membershipPage.waitForAccountDetails();
    await expect(membershipPage.newsletterToggle).toBeChecked();
    await expect(membershipPage.newsletterStatus).toContainText('Subscribed');
  });

  test('subscribed member can unsubscribe from newsletter', async ({ authenticatedPage }) => {
    const membershipPage = new MembershipPage(authenticatedPage);
    await membershipPage.waitForAccountDetails();

    // Subscribe first
    await membershipPage.toggleNewsletter();
    await expect(membershipPage.newsletterUpdating).toBeHidden({ timeout: 10_000 });
    await expect(membershipPage.newsletterToggle).toBeChecked();

    // Now unsubscribe
    await membershipPage.toggleNewsletter();
    await expect(membershipPage.newsletterUpdating).toBeHidden({ timeout: 10_000 });

    // Verify unsubscribed
    await expect(membershipPage.newsletterStatus).toContainText('Not subscribed');
    await expect(membershipPage.newsletterToggle).not.toBeChecked();

    // Verify persistence after reload
    await authenticatedPage.reload();
    await membershipPage.waitForAccountDetails();
    await expect(membershipPage.newsletterToggle).not.toBeChecked();
  });
});

base.describe('Authentication Protection', () => {
  base.beforeEach(async ({ context }) => {
    // Clear all cookies and storage to ensure fresh unauthenticated state
    await context.clearCookies();
    await context.clearPermissions();
  });

  base('redirects unauthenticated users to sign-in page', async ({ page }) => {
    // Clear any cached auth state
    await page.goto('/sign-in'); // Go to a safe page first
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Now try to access membership page
    await page.goto('/membership');

    // Should redirect to sign-in
    await page.waitForURL('/sign-in', { timeout: 10_000 });

    // Should show sign-in page heading
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
  });

  base('prevents access to membership page without valid session', async ({ page }) => {
    // Navigate to a safe page first, then clear storage
    await page.goto('/sign-in');
    await page.evaluate(() => {
      localStorage.clear();
      sessionStorage.clear();
    });

    // Try to access membership directly
    await page.goto('/membership');
    await page.waitForURL('/sign-in', { timeout: 10_000 });

    // Verify sign-in page is displayed
    await expect(page.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    await expect(page.getByLabel('Email Address')).toBeVisible();
    await expect(page.getByLabel('Password')).toBeVisible();
  });
});
