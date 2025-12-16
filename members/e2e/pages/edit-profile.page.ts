import type { Page, Locator } from '@playwright/test';

export class EditProfilePage {
  readonly page: Page;
  readonly pageHeading: Locator;
  readonly loadingMessage: Locator;
  readonly errorMessage: Locator;
  readonly successMessage: Locator;

  // Form fields
  readonly titleInput: Locator;
  readonly pronounsInput: Locator;
  readonly credentialsInput: Locator;
  readonly bioTextarea: Locator;
  readonly businessNameInput: Locator;
  readonly phoneInput: Locator;
  readonly emailInput: Locator;
  readonly websiteInput: Locator;

  // Form buttons
  readonly saveButton: Locator;
  readonly cancelButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.pageHeading = page.getByRole('heading', { name: /Edit.*Profile/i, level: 1 });
    this.loadingMessage = page.getByText('Loading profile...');
    this.errorMessage = page.locator('.error-message'); // Updated: scoped to error container
    this.successMessage = page.locator('.success-message'); // Updated: scoped to success container

    // Form field selectors using labels
    this.titleInput = page.getByLabel(/^Title/i);
    this.pronounsInput = page.getByLabel(/Pronouns/i);
    this.credentialsInput = page.getByLabel(/Credentials/i);
    this.bioTextarea = page.getByLabel(/Bio/i);
    this.businessNameInput = page.getByLabel(/Business Name/i);
    this.phoneInput = page.getByLabel(/Phone/i);
    this.emailInput = page.getByLabel(/Email/i);
    this.websiteInput = page.getByLabel(/Website/i);

    // Action buttons
    this.saveButton = page.getByRole('button', { name: /Save.*Profile/i });
    this.cancelButton = page.getByRole('button', { name: /Cancel/i });
  }

  async goto(): Promise<void> {
    await this.page.goto('/profile');
  }

  async waitForProfileForm(): Promise<void> {
    await this.pageHeading.waitFor({ state: 'visible' });
    await this.titleInput.waitFor({ state: 'visible' });
  }

  async fillBasicProfile(data: {
    title: string;
    bio: string;
    pronouns?: string;
    credentials?: string;
  }): Promise<void> {
    await this.titleInput.fill(data.title);
    await this.bioTextarea.fill(data.bio);
    if (data.pronouns) {
      await this.pronounsInput.fill(data.pronouns);
    }
    if (data.credentials) {
      await this.credentialsInput.fill(data.credentials);
    }
  }

  async fillContactInfo(contact: {
    email?: string;
    phone?: string;
    website?: string;
    businessName?: string;
  }): Promise<void> {
    if (contact.email) {
      await this.emailInput.fill(contact.email);
    }
    if (contact.phone) {
      await this.phoneInput.fill(contact.phone);
    }
    if (contact.website) {
      await this.websiteInput.fill(contact.website);
    }
    if (contact.businessName) {
      await this.businessNameInput.fill(contact.businessName);
    }
  }

  async saveProfile(): Promise<void> {
    await this.saveButton.click();
  }

  async cancelEdit(): Promise<void> {
    await this.cancelButton.click();
  }
}
