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
<<<<<<< HEAD
  readonly deleteProfileButton: Locator;
=======
  readonly changeEmailButton: Locator;

  // Change email form
  readonly newEmailInput: Locator;
  readonly confirmChangeButton: Locator;
  readonly cancelChangeButton: Locator;
>>>>>>> 6d5f9ef (test: add e2e tests for change email and resend invitation flow)

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

    // Actions - matches both "Send Invitation" and "Invitation Already Sent"
    this.sendInvitationButton = page.getByRole('button', { name: /Invitation/ });
<<<<<<< HEAD
    this.deleteProfileButton = page.getByRole('button', { name: /Delete Profile/ });
=======
    this.changeEmailButton = page.getByRole('button', {
      name: 'Change Email & Resend Invitation',
    });

    // Change email form
    this.newEmailInput = page.getByLabel('New Email Address');
    this.confirmChangeButton = page.getByRole('button', { name: 'Confirm Change & Resend' });
    this.cancelChangeButton = page.getByRole('button', { name: 'Cancel' });
>>>>>>> 6d5f9ef (test: add e2e tests for change email and resend invitation flow)

    // Status messages
    this.loadingText = page.getByText('Loading details...');
    this.errorMessage = page.getByRole('alert');
    this.successMessage = page.getByRole('status');
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
}
