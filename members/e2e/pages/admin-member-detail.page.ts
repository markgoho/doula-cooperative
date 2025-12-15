import type { Page, Locator } from '@playwright/test';

export class AdminMemberDetailPage {
  readonly page: Page;
  readonly pageHeading: Locator;
  readonly loadingMessage: Locator;

  // Account Information
  readonly nameValue: Locator;
  readonly emailValue: Locator;
  readonly uidValue: Locator;
  readonly membershipStatus: Locator;

  // Membership Actions
  readonly activateButton: Locator;
  readonly deactivateButton: Locator;
  readonly deleteButton: Locator;

  // Confirm Dialog
  readonly confirmDialog: Locator;
  readonly confirmMessage: Locator;
  readonly confirmButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeading = page.getByRole('heading', { name: 'Member Details', level: 1 });
    this.loadingMessage = page.getByText('Loading details...');

    // Account Information selectors using aria-labelledby
    this.nameValue = page.getByLabel('Name:');
    this.emailValue = page.getByLabel('Email:');
    this.uidValue = page.getByLabel('UID:');
    this.membershipStatus = page.getByLabel('Membership:');

    // Action buttons
    this.activateButton = page.getByRole('button', { name: /Activate Membership/ });
    this.deactivateButton = page.getByRole('button', { name: /Deactivate Membership/ });
    this.deleteButton = page.getByRole('button', { name: /Delete User Account/ });

    // Confirm dialog
    this.confirmDialog = page.getByRole('dialog');
    this.confirmMessage = this.confirmDialog.getByText(/Are you sure/);
    this.confirmButton = this.confirmDialog.getByRole('button', { name: 'Confirm' });
    this.cancelButton = this.confirmDialog.getByRole('button', { name: 'Cancel' });
  }

  async goto(uid: string): Promise<void> {
    await this.page.goto(`/admin/users/member/${uid}`);
  }

  async waitForMemberDetails(): Promise<void> {
    await this.pageHeading.waitFor({ state: 'visible' });
    await this.membershipStatus.waitFor({ state: 'visible' });
  }

  async activateMembership(): Promise<void> {
    await this.activateButton.click();
    await this.confirmDialog.waitFor({ state: 'visible' });
    await this.confirmButton.click();
  }

  async deactivateMembership(): Promise<void> {
    await this.deactivateButton.click();
    await this.confirmDialog.waitFor({ state: 'visible' });
    await this.confirmButton.click();
  }

  async deleteUser(): Promise<void> {
    await this.deleteButton.click();
    await this.confirmDialog.waitFor({ state: 'visible' });
    await this.confirmButton.click();
  }

  async cancelAction(): Promise<void> {
    await this.cancelButton.click();
  }
}
