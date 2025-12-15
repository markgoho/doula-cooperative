import type { Page } from '@playwright/test';

/**
 * Page object for Admin Unclaimed Profile Detail page.
 * Represents /admin/users/unclaimed/:email route.
 */
export class AdminUnclaimedProfileDetailPage {
  readonly page: Page;

  // Main page elements
  readonly pageHeading = this.page.getByRole('heading', { name: 'Unclaimed Profile Details', level: 1 });
  readonly sectionHeading = this.page.getByRole('heading', { name: 'Unclaimed Profile Information', level: 2 });
  readonly membershipHeading = this.page.getByRole('heading', { name: 'Membership Details', level: 2 });

  // Profile information (using definition lists for structured data)
  readonly nameValue = this.page.locator('dt:has-text("Name:") + dd');
  readonly emailValue = this.page.locator('dt:has-text("Email:") + dd');
  readonly hasProfileValue = this.page.locator('dt:has-text("Has Profile:") + dd');

  // Membership details
  readonly subscriptionStartValue = this.page.locator('dt:has-text("Subscription Start:") + dd');
  readonly lastPaymentValue = this.page.locator('dt:has-text("Last Payment:") + dd');
  readonly nextPaymentValue = this.page.locator('dt:has-text("Next Payment:") + dd');
  readonly invitationEmailValue = this.page.locator('dt:has-text("Invitation Email:") + dd');

  // Actions
  readonly sendInvitationButton = this.page.getByRole('button', { name: /Send Invitation/ });
  readonly loadingText = this.page.getByText('Loading details...');
  readonly errorMessage = this.page.locator('.error');

  constructor(page: Page) {
    this.page = page;
  }

  async goto(email: string): Promise<void> {
    await this.page.goto(`/admin/users/unclaimed/${encodeURIComponent(email)}`);
  }

  async waitForProfileDetails(): Promise<void> {
    await this.sectionHeading.waitFor({ state: 'visible' });
  }

  async sendInvitation(): Promise<void> {
    await this.sendInvitationButton.click();
  }
}
