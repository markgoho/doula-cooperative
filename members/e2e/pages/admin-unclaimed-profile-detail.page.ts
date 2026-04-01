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
  readonly deleteProfileButton: Locator;
  readonly draftProfileButton: Locator;
  readonly updateEmailButton: Locator;

  // Update email form
  readonly updateEmailInput: Locator;
  readonly confirmUpdateButton: Locator;
  readonly cancelUpdateButton: Locator;

  // Status messages (reused for state verification)
  readonly loadingText: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;
  readonly warningMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page structure
    this.pageHeading = page.getByRole('heading', { name: 'Legacy Membership Details', level: 1 });
    this.sectionHeading = page.getByRole('heading', {
      name: 'Legacy Membership Information',
      level: 2,
    });

    this.deleteProfileButton = page.getByRole('button', { name: /Delete Profile/ });
    this.draftProfileButton = page.getByRole('button', { name: 'Set Profile to Draft' });
    // Update email form
    this.updateEmailButton = page.getByRole('button', { name: 'Update Email' });
    this.updateEmailInput = page.getByLabel('New Email Address');
    this.confirmUpdateButton = page.getByRole('button', { name: 'Confirm Update' });
    this.cancelUpdateButton = page.getByRole('button', { name: 'Cancel' });

    // Status messages
    this.loadingText = page.getByText('Loading details...');
    this.errorMessage = page.getByRole('alert');
    this.successMessage = page.getByRole('status');
    this.warningMessage = page.locator('app-alert-banner.warning');
  }

  async goto(email: string): Promise<void> {
    await this.page.goto(`/admin/unclaimed/${encodeURIComponent(email)}`);
  }

  async waitForProfileDetails(): Promise<void> {
    await this.sectionHeading.waitFor({ state: 'visible' });
  }

  async fillAndSubmitUpdateEmail(newEmail: string): Promise<void> {
    await this.updateEmailButton.click();
    await this.updateEmailInput.fill(newEmail);
    await this.confirmUpdateButton.click();
  }

  async confirmDraftProfile(): Promise<void> {
    await this.draftProfileButton.click();
    const dialog = this.page.locator('dialog[open]');
    await dialog.getByRole('button', { name: 'Set to Draft' }).click();
  }
}
