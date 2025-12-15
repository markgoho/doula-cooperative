import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for the Admin Users page (/admin/users).
 *
 * Encapsulates all locators and actions for interacting with the admin
 * user management dashboard, including the active members table and
 * unclaimed profiles table. Uses accessibility-first selectors (roles, labels)
 * to ensure tests break if accessibility is compromised.
 *
 * @example
 * const adminUsersPage = new AdminUsersPage(page);
 * await adminUsersPage.goto();
 * await adminUsersPage.waitForMembersTable();
 * await expect(adminUsersPage.membersTable).toBeVisible();
 */
export class AdminUsersPage {
  readonly page: Page;

  // Headings
  readonly pageHeading: Locator;
  readonly activeMembersHeading: Locator;
  readonly unclaimedProfilesHeading: Locator;

  // Header stats
  readonly headerStats: Locator;
  readonly totalMembersText: Locator;
  readonly totalUnclaimedText: Locator;

  // Members table
  readonly membersTable: Locator;
  readonly membersTableHeaders: Locator;
  readonly membersTableRows: Locator;

  // Loading and error states
  readonly loadingMessage: Locator;
  readonly errorMessage: Locator;

  // Table column headers (for sort testing)
  readonly nameHeader: Locator;
  readonly emailHeader: Locator;
  readonly membershipHeader: Locator;
  readonly createdHeader: Locator;

  constructor(page: Page) {
    this.page = page;

    // Headings - use role-based selectors
    this.pageHeading = page.getByRole('heading', { name: 'User Management', level: 1 });
    this.activeMembersHeading = page.getByRole('heading', { name: 'Active Members', level: 2 });
    this.unclaimedProfilesHeading = page.getByRole('heading', { name: 'Unclaimed Profiles', level: 2 });

    // Header stats - use text-based selectors
    this.totalMembersText = page.getByText(/Total Members:/);
    this.totalUnclaimedText = page.getByText(/Unclaimed Profiles:/);
    // Header stats container - scope by finding the region containing both stats
    this.headerStats = this.totalMembersText.locator('xpath=./..').filter({ has: this.totalUnclaimedText });

    // Members table - scoped to Active Members section by finding the section with that heading
    // Use the heading to identify the correct section without relying on CSS classes
    const activeMembersSection = this.activeMembersHeading.locator('xpath=./..');
    this.membersTable = activeMembersSection.getByRole('table');
    this.membersTableHeaders = this.membersTable.getByRole('columnheader');
    this.membersTableRows = this.membersTable.getByRole('row').filter({ has: page.getByRole('cell') });

    // Loading and error states - text-based
    this.loadingMessage = activeMembersSection.getByText('Loading members...');
    this.errorMessage = activeMembersSection.getByText(/Failed to load members/i);

    // Table column headers - scoped to members table to avoid confusion with unclaimed profiles table
    this.nameHeader = this.membersTable.getByRole('columnheader', { name: /Name/i });
    this.emailHeader = this.membersTable.getByRole('columnheader', { name: /Email/i });
    this.membershipHeader = this.membersTable.getByRole('columnheader', { name: /Membership/i });
    this.createdHeader = this.membersTable.getByRole('columnheader', { name: /Created/i });
  }

  /**
   * Navigate to the admin users page.
   *
   * @example
   * await adminUsersPage.goto();
   */
  async goto() {
    await this.page.goto('/admin/users');
  }

  /**
   * Wait for members table to be visible.
   * Use this after navigation to ensure the page has fully loaded
   * and member data has been fetched from the API.
   *
   * @example
   * await adminUsersPage.waitForMembersTable();
   * await expect(adminUsersPage.membersTable).toBeVisible();
   */
  async waitForMembersTable() {
    await this.membersTable.waitFor({ state: 'visible', timeout: 10_000 });
  }

  /**
   * Get a specific member row by email address.
   *
   * @param email - The email address of the member to find
   * @returns Locator for the member row
   *
   * @example
   * const memberRow = adminUsersPage.getMemberRow('test@example.com');
   * await expect(memberRow).toBeVisible();
   */
  getMemberRow(email: string): Locator {
    return this.page.getByRole('row').filter({ hasText: email });
  }

  /**
   * Click the "View" button for a specific member.
   *
   * @param email - The email address of the member
   *
   * @example
   * await adminUsersPage.viewMember('test@example.com');
   * await expect(page).toHaveURL(/\/admin\/users\/member\/[a-zA-Z0-9]+/);
   */
  async viewMember(email: string) {
    const row = this.getMemberRow(email);
    await row.getByRole('link', { name: 'View' }).click();
  }

  /**
   * Sort the table by a specific column.
   *
   * @param column - The column to sort by ('Name', 'Email', 'Membership', 'Created')
   *
   * @example
   * await adminUsersPage.sortBy('Name');
   * // Verify sort indicator
   * await expect(adminUsersPage.nameHeader).toContainText('↑');
   */
  async sortBy(column: 'Name' | 'Email' | 'Membership' | 'Created') {
    const headerMap = {
      Name: this.nameHeader,
      Email: this.emailHeader,
      Membership: this.membershipHeader,
      Created: this.createdHeader,
    };

    await headerMap[column].click();
  }
}
