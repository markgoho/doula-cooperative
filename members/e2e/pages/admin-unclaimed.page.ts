import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for the Admin Unclaimed Profiles page (/admin/unclaimed).
 *
 * Encapsulates all locators and actions for interacting with the admin
 * unclaimed profiles list page. Uses accessibility-first selectors (roles, labels)
 * to ensure tests break if accessibility is compromised.
 *
 * @example
 * const adminUnclaimedPage = new AdminUnclaimedPage(page);
 * await adminUnclaimedPage.goto();
 * await adminUnclaimedPage.waitForProfilesTable();
 * await expect(adminUnclaimedPage.profilesTable).toBeVisible();
 */
export class AdminUnclaimedPage {
  readonly page: Page;

  // Headings
  readonly pageHeading: Locator;
  readonly unclaimedProfilesHeading: Locator;

  // Header stats
  readonly headerStats: Locator;
  readonly totalUnclaimedText: Locator;

  // Profiles table
  readonly profilesTable: Locator;
  readonly profilesTableHeaders: Locator;
  readonly profilesTableRows: Locator;

  // Loading and error states
  readonly loadingMessage: Locator;
  readonly errorMessage: Locator;

  // Table column headers (for sort testing)
  readonly nameHeader: Locator;
  readonly emailHeader: Locator;
  readonly hasProfileHeader: Locator;
  readonly subscriptionStartHeader: Locator;

  constructor(page: Page) {
    this.page = page;

    // Headings - use role-based selectors
    this.pageHeading = page.getByRole('heading', { name: 'Unclaimed Profiles', level: 1 });
    this.unclaimedProfilesHeading = page.getByRole('heading', {
      name: 'Unclaimed Profiles',
      level: 2,
    });

    // Header stats - use text-based selectors
    this.totalUnclaimedText = page.getByText(/Total Unclaimed:/);
    // Header stats container - use CSS class since no better semantic selector available
    this.headerStats = page.locator('.header-stats');

    // Profiles table - use Angular component selector for reliable scoping
    const unclaimedProfilesTable = page.locator('app-unclaimed-profiles-table');
    this.profilesTable = unclaimedProfilesTable.getByRole('table');
    this.profilesTableHeaders = this.profilesTable.getByRole('columnheader');
    this.profilesTableRows = this.profilesTable
      .getByRole('row')
      .filter({ has: page.getByRole('cell') });

    // Loading and error states - text-based
    this.loadingMessage = unclaimedProfilesTable.getByText('Loading unclaimed profiles...');
    this.errorMessage = unclaimedProfilesTable.getByText(/Failed to load unclaimed profiles/i);

    // Table column headers - scoped to profiles table
    this.nameHeader = this.profilesTable.getByRole('columnheader', { name: /Name/i });
    this.emailHeader = this.profilesTable.getByRole('columnheader', { name: /Email/i });
    this.hasProfileHeader = this.profilesTable.getByRole('columnheader', { name: /Has Profile/i });
    this.subscriptionStartHeader = this.profilesTable.getByRole('columnheader', {
      name: /Subscription Start/i,
    });
  }

  /**
   * Navigate to the admin unclaimed profiles page.
   *
   * @example
   * await adminUnclaimedPage.goto();
   */
  async goto(): Promise<void> {
    await this.page.goto('/admin/unclaimed');
  }

  /**
   * Wait for profiles table to be visible.
   * Use this after navigation to ensure the page has fully loaded
   * and profile data has been fetched from the API.
   *
   * @example
   * await adminUnclaimedPage.waitForProfilesTable();
   * await expect(adminUnclaimedPage.profilesTable).toBeVisible();
   */
  async waitForProfilesTable(): Promise<void> {
    await this.profilesTable.waitFor({ state: 'visible', timeout: 10_000 });
  }

  /**
   * Get a specific profile row by email address.
   *
   * @param email - The email address of the profile to find
   * @returns Locator for the profile row
   *
   * @example
   * const profileRow = adminUnclaimedPage.getProfileRow('test@example.com');
   * await expect(profileRow).toBeVisible();
   */
  getProfileRow(email: string): Locator {
    return this.page.getByRole('row').filter({ hasText: email });
  }

  /**
   * Click the "View" link for a specific profile.
   *
   * @param email - The email address of the profile
   *
   * @example
   * await adminUnclaimedPage.viewProfile('test@example.com');
   * await expect(page).toHaveURL(/\/admin\/unclaimed\/[^/]+/);
   */
  async viewProfile(email: string): Promise<void> {
    const row = this.getProfileRow(email);
    await row.getByRole('link', { name: 'View' }).click();
  }

  /**
   * Sort the table by a specific column.
   * Waits for the sort indicator to appear on the clicked column.
   *
   * @param column - The column to sort by
   *
   * @example
   * await adminUnclaimedPage.sortBy('Name');
   * // Sort indicator is already visible after sortBy returns
   */
  async sortBy(column: 'Name' | 'Email' | 'Has Profile' | 'Subscription Start'): Promise<void> {
    const headerMap = {
      Name: this.nameHeader,
      Email: this.emailHeader,
      'Has Profile': this.hasProfileHeader,
      'Subscription Start': this.subscriptionStartHeader,
    };

    const header = headerMap[column];
    await header.click();

    // Wait for Angular to process the click and update the DOM
    // The sort indicator should appear on this column
    await header.locator('.sort-indicator').waitFor({ state: 'visible', timeout: 5000 });
  }
}
