import type { Page, Locator } from '@playwright/test';

/**
 * Page object for Admin Unclaimed Profile Detail page.
 * Represents /admin/unclaimed/:email route.
 *
 * Only includes commonly reused selectors and action methods.
 * Use ad-hoc selectors in tests for data verification (names, emails, dates).
 */
export class AdminUnclaimedProfileDetailPage {
  readonly page: Page;

  // Page structure (reused to verify page loaded)
  readonly pageHeading: Locator;
  readonly sectionHeading: Locator;

  // Actions (reused across tests)
  readonly sendInvitationButton: Locator;

  // Status messages (reused for state verification)
  readonly loadingText: Locator;
  readonly errorMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page structure
    this.pageHeading = page.getByRole('heading', { name: 'Unclaimed Profile Details', level: 1 });
    this.sectionHeading = page.getByRole('heading', { name: 'Unclaimed Profile Information', level: 2 });

    // Actions - matches both "Send Invitation" and "Invitation Already Sent"
    this.sendInvitationButton = page.getByRole('button', { name: /Invitation/ });

    // Status messages
    this.loadingText = page.getByText('Loading details...');
    this.errorMessage = page.getByRole('alert');
  }

  async goto(email: string): Promise<void> {
    await this.page.goto(`/admin/unclaimed/${encodeURIComponent(email)}`);
  }

  async waitForProfileDetails(): Promise<void> {
    await this.sectionHeading.waitFor({ state: 'visible' });
  }

  async sendInvitation(): Promise<void> {
    await this.sendInvitationButton.click();
  }
}
