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
  readonly deleteProfileButton: Locator;
  readonly changeEmailButton: Locator;
  readonly updateEmailButton: Locator;

  // Change email form
  readonly newEmailInput: Locator;
  readonly confirmChangeButton: Locator;
  readonly cancelChangeButton: Locator;

  // Update email form
  readonly updateEmailInput: Locator;
  readonly confirmUpdateButton: Locator;
  readonly cancelUpdateButton: Locator;

  // Status messages (reused for state verification)
  readonly loadingText: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  constructor(page: Page) {
    this.page = page;

    // Page structure
    this.pageHeading = page.getByRole('heading', { name: 'Unclaimed Profile Details', level: 1 });
    this.sectionHeading = page.getByRole('heading', {
      name: 'Unclaimed Profile Information',
      level: 2,
    });

    this.sendInvitationButton = page.getByRole('button', {
      name: /^(Send Invitation|Invitation Already Sent|Processing\.\.\.)$/,
    });
    this.deleteProfileButton = page.getByRole('button', { name: /Delete Profile/ });
    this.changeEmailButton = page.getByRole('button', {
      name: 'Change Email & Resend Invitation',
    });

    // Change email form
    this.newEmailInput = page.getByLabel('New Email Address');
    this.confirmChangeButton = page.getByRole('button', { name: 'Confirm Change & Resend' });
    this.cancelChangeButton = page.getByRole('button', { name: 'Cancel' });

    // Update email form
    this.updateEmailButton = page.getByRole('button', { name: 'Update Email' });
    this.updateEmailInput = page.getByLabel('New Email Address');
    this.confirmUpdateButton = page.getByRole('button', { name: 'Confirm Update' });
    this.cancelUpdateButton = page.getByRole('button', { name: 'Cancel' });

    // Status messages
    this.loadingText = page.getByText('Loading details...');
    this.errorMessage = page.getByRole('alert');
    this.successMessage = page.locator('app-alert-banner.success');
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

  async fillAndSubmitChangeEmail(newEmail: string): Promise<void> {
    await this.changeEmailButton.click();
    await this.newEmailInput.fill(newEmail);
    await this.confirmChangeButton.click();
  }

  async fillAndSubmitUpdateEmail(newEmail: string): Promise<void> {
    await this.updateEmailButton.click();
    await this.updateEmailInput.fill(newEmail);
    await this.confirmUpdateButton.click();
  }
}
