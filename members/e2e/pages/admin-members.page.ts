import { type Page, type Locator } from '@playwright/test';

/**
 * Page Object Model for the Admin Members page (/admin/members).
 *
 * Encapsulates all locators and actions for interacting with the admin
 * members list page. Uses accessibility-first selectors (roles, labels)
 * to ensure tests break if accessibility is compromised.
 *
 * @example
 * const adminMembersPage = new AdminMembersPage(page);
 * await adminMembersPage.goto();
 * await adminMembersPage.waitForMembersTable();
 * await expect(adminMembersPage.membersTable).toBeVisible();
 */
export class AdminMembersPage {
  readonly page: Page;

  // Headings
  readonly pageHeading: Locator;
  readonly activeMembersHeading: Locator;

  // Header stats
  readonly headerStats: Locator;
  readonly totalMembersText: Locator;

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
    this.pageHeading = page.getByRole('heading', { name: 'Members', level: 1 });
    this.activeMembersHeading = page.getByRole('heading', { name: 'Active Members', level: 2 });

    // Header stats - use text-based selectors
    this.totalMembersText = page.getByText(/Total Members:/);
    // Header stats container - use CSS class since no better semantic selector available
    this.headerStats = page.locator('.header-stats');

    // Members table - use Angular component selector for reliable scoping
    // This targets the active-members-table component specifically
    const activeMembersTable = page.locator('app-active-members-table');
    this.membersTable = activeMembersTable.getByRole('table');
    this.membersTableHeaders = this.membersTable.getByRole('columnheader');
    this.membersTableRows = this.membersTable
      .getByRole('row')
      .filter({ has: page.getByRole('cell') });

    // Loading and error states - text-based
    this.loadingMessage = activeMembersTable.getByText('Loading members...');
    this.errorMessage = activeMembersTable.getByText(/Failed to load members/i);

    // Table column headers - scoped to members table
    this.nameHeader = this.membersTable.getByRole('columnheader', { name: /Name/i });
    this.emailHeader = this.membersTable.getByRole('columnheader', { name: /Email/i });
    this.membershipHeader = this.membersTable.getByRole('columnheader', { name: /Membership/i });
    this.createdHeader = this.membersTable.getByRole('columnheader', { name: /Created/i });
  }

  /**
   * Navigate to the admin members page.
   *
   * @example
   * await adminMembersPage.goto();
   */
  async goto() {
    await this.page.goto('/admin/members');
  }

  /**
   * Wait for members table to be visible.
   * Use this after navigation to ensure the page has fully loaded
   * and member data has been fetched from the API.
   *
   * @example
   * await adminMembersPage.waitForMembersTable();
   * await expect(adminMembersPage.membersTable).toBeVisible();
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
   * const memberRow = adminMembersPage.getMemberRow('test@example.com');
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
   * await adminMembersPage.viewMember('test@example.com');
   * await expect(page).toHaveURL(/\/admin\/members\/[a-zA-Z0-9]+/);
   */
  async viewMember(email: string) {
    const row = this.getMemberRow(email);
    await row.getByRole('link', { name: 'View' }).click();
  }

  /**
   * Sort the table by a specific column.
   * Waits for the sort indicator to appear on the clicked column.
   *
   * @param column - The column to sort by ('Name', 'Email', 'Membership', 'Created')
   *
   * @example
   * await adminMembersPage.sortBy('Name');
   * // Sort indicator is already visible after sortBy returns
   */
  async sortBy(column: 'Name' | 'Email' | 'Membership' | 'Created') {
    const headerMap = {
      Name: this.nameHeader,
      Email: this.emailHeader,
      Membership: this.membershipHeader,
      Created: this.createdHeader,
    };

    const header = headerMap[column];
    await header.click();

    // Wait for Angular to process the click and update the DOM
    // The sort indicator should appear on this column
    await header.locator('.sort-indicator').waitFor({ state: 'visible', timeout: 5000 });
  }
}
