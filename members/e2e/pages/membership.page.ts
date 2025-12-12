import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for the Membership page (/membership).
 *
 * Encapsulates all locators and actions for interacting with the membership
 * dashboard, including account details, payment information, and newsletter
 * preferences. Uses accessibility-first selectors (roles, labels) to ensure
 * tests break if accessibility is compromised.
 *
 * @example
 * const membershipPage = new MembershipPage(page);
 * await membershipPage.goto();
 * await membershipPage.waitForAccountDetails();
 * await expect(membershipPage.fullNameItem).toContainText('John Doe');
 *
 * @example
 * // Test newsletter toggle interaction
 * await membershipPage.toggleNewsletter();
 * await expect(membershipPage.newsletterUpdating).toBeHidden();
 * await expect(membershipPage.newsletterStatus).toContainText('Subscribed');
 */
export class MembershipPage {
  readonly page: Page;

  // Headings
  readonly pageHeading: Locator;
  readonly accountDetailsHeading: Locator;
  readonly newsletterHeading: Locator;
  readonly paymentHeading: Locator;

  // Welcome section
  readonly welcomeMessage: Locator;

  // Account details
  readonly accountDetailsSection: Locator;
  readonly fullNameItem: Locator;
  readonly emailItem: Locator;
  readonly emailVerifiedItem: Locator;
  readonly accountCreatedItem: Locator;
  readonly subscriptionItem: Locator;

  // Payment information
  readonly lastPaymentItem: Locator;
  readonly nextPaymentItem: Locator;
  readonly membershipExpiresItem: Locator;

  // Newsletter
  readonly newsletterToggle: Locator;
  readonly newsletterStatus: Locator;
  readonly newsletterUpdating: Locator;

  // Actions
  readonly signOutButton: Locator;

  // Loading states
  readonly loadingMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Headings
    this.pageHeading = page.getByRole('heading', { name: 'Membership', level: 1 });
    this.accountDetailsHeading = page.getByRole('heading', { name: 'Your Account Details' });
    this.newsletterHeading = page.getByRole('heading', { name: 'Newsletter Preferences' });
    this.paymentHeading = page.getByRole('heading', { name: 'Payment Information' });

    // Welcome section
    this.welcomeMessage = page.locator('.welcome-section p').first();

    // Account details section
    this.accountDetailsSection = page.locator('.membership-info-section');
    this.fullNameItem = page.locator('.detail-item').filter({ hasText: 'Full Name:' });
    this.emailItem = page.locator('.detail-item').filter({ hasText: /^Email:/ });
    this.emailVerifiedItem = page.locator('.detail-item').filter({ hasText: 'Email Verified:' });
    this.accountCreatedItem = page.locator('.detail-item').filter({ hasText: 'Account Created:' });
    this.subscriptionItem = page
      .locator('.detail-item')
      .filter({ hasText: 'Doula Cooperative Subscription:' });

    // Payment information
    this.lastPaymentItem = page.locator('.detail-item').filter({ hasText: 'Last Payment:' });
    this.nextPaymentItem = page.locator('.detail-item').filter({ hasText: 'Next Payment:' });
    this.membershipExpiresItem = page
      .locator('.detail-item')
      .filter({ hasText: 'Membership Expires:' });

    // Newsletter
    this.newsletterToggle = page.locator('.newsletter-preference input[type="checkbox"]');
    this.newsletterStatus = page.locator('.toggle-text');
    this.newsletterUpdating = page.locator('.update-status');

    // Actions
    this.signOutButton = page.getByRole('button', { name: 'Sign Out' });

    // Loading states
    this.loadingMessage = page.getByText('Loading membership information...');
  }

  /**
   * Navigate to the membership page.
   *
   * @example
   * await membershipPage.goto();
   */
  async goto() {
    await this.page.goto('/membership');
  }

  /**
   * Wait for account details section to be visible.
   * Use this after navigation to ensure the page has fully loaded
   * and member data has been fetched from Firestore.
   *
   * @example
   * await membershipPage.waitForAccountDetails();
   * await expect(membershipPage.fullNameItem).toBeVisible();
   */
  async waitForAccountDetails() {
    await this.accountDetailsSection.waitFor({ state: 'visible' });
  }

  /**
   * Click the sign out button and initiate logout flow.
   * After calling this, the user should be redirected to /sign-in.
   *
   * @example
   * await membershipPage.signOut();
   * await expect(page).toHaveURL('/sign-in');
   */
  async signOut() {
    await this.signOutButton.click();
  }

  /**
   * Toggle newsletter subscription checkbox.
   *
   * Note: This triggers an async API call to updateNewsletterPreference
   * Firebase function. Wait for newsletterUpdating to disappear before
   * asserting on the final state.
   *
   * @example
   * await membershipPage.toggleNewsletter();
   * await expect(membershipPage.newsletterUpdating).toBeHidden();
   * await expect(membershipPage.newsletterStatus).toContainText('Subscribed');
   */
  async toggleNewsletter() {
    await this.newsletterToggle.click();
  }
}
