import { test } from '../fixtures/regular-user-auth.fixture';
import { expect } from '@playwright/test';
import type { ProfileData } from '../../src/app/types/profile-data';
import { EditProfilePage } from '../pages/edit-profile.page';
import type { ApiMemberResponse } from '../../src/app/api-types/members-api.types';

const mockMemberDocument: ApiMemberResponse = {
  uid: 'test-user-uid',
  email: 'test-user@doulacooperative.com',
  name: 'Test User',
  createdAt: '2024-01-01T00:00:00.000Z',
  isAdmin: false,
  subscriptionStart: '2024-01-01T00:00:00.000Z',
  membershipActive: true,
  slug: 'test-user',
};

const mockProfileData: ProfileData = {
  title: 'Test User',
  bio: 'I am a test doula with experience.',
  credentials: 'CD(DONA)',
  pronouns: 'she/her',
  tags: ['Birth Doula'],
  contact: { email: 'test-user@doulacooperative.com' },
  draft: true,
};

function setupApiMocks(page: import('@playwright/test').Page) {
  return Promise.all([
    // Mock member document (no profileCreatedAt so wizard doesn't redirect)
    page.route('**/api/members/*', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMemberDocument),
          })
        : route.continue());
    }),

    // Mock slug availability check (slug is available)
    page.route(/\/api\/profiles\/slugs\/check(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: true }),
      });
    }),

    // Mock slug update
    page.route('**/api/profiles/slugs', async (route) => {
      await (route.request().method() === 'POST'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({ success: true, slug: 'test-user' }),
          })
        : route.continue());
    }),

    // Mock profile creation (POST) and profile fetch (GET)
    page.route('**/api/profiles/test-user', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, profile: mockProfileData }),
        });
      } else if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProfileData),
        });
      } else {
        await route.continue();
      }
    }),
  ]);
}

async function walkThroughWizard(page: import('@playwright/test').Page) {
  await page.goto('/profile/create');

  // === Step 1: Personal Info ===
  await page
    .getByRole('heading', { name: /Personal Information/i, level: 2 })
    .waitFor({ state: 'visible' });
  // Name is pre-filled from member document, but we clear and type to trigger slug validator
  await page.getByLabel(/^Name/i).fill('Test User');
  // Wait for async slug validator to resolve (shows URL preview)
  await expect(page.getByText(/Your profile URL/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Next' }).click();

  // === Step 2: Tags ===
  await page
    .getByRole('heading', { name: /Services & Specialties/i, level: 2 })
    .waitFor({ state: 'visible' });
  await page.getByLabel('Birth Doula').check();
  await page.getByRole('button', { name: 'Next' }).click();

  // === Step 3: Bio ===
  await page.getByRole('heading', { name: /About You/i, level: 2 }).waitFor({ state: 'visible' });
  await page.getByLabel(/Bio/i).fill('I am a test doula with experience.');
  await page.getByRole('button', { name: 'Next' }).click();

  // === Step 4: Contact (triggers profile creation POST) ===
  await page
    .getByRole('heading', { name: /Contact Information/i, level: 2 })
    .waitFor({ state: 'visible' });
  await page.getByRole('button', { name: 'Next' }).click();

  // === Step 5: Image (skip) ===
  await page
    .getByRole('heading', { name: /Profile Photo/i, level: 2 })
    .waitFor({ state: 'visible' });
  await page.getByRole('button', { name: /Skip for now/i }).click();

  // === Step 6: Preview ===
  await page
    .getByRole('heading', { name: /Preview Your Profile/i, level: 2 })
    .waitFor({ state: 'visible' });
  await expect(page.getByText(/Your profile has been created/i)).toBeVisible();
  await page.getByRole('button', { name: 'Finish' }).click();

  // Wait for navigation to the edit profile page
  await page.waitForURL('/profile', { timeout: 10_000 });
}

test.describe('Create Profile → Edit Profile Flow', () => {
  test('walks through wizard and loads edit profile form with created data', async ({
    authenticatedUserPage,
  }) => {
    await setupApiMocks(authenticatedUserPage);

    // === Walk through the 6-step wizard ===
    await walkThroughWizard(authenticatedUserPage);

    // === Profile form should load with data from the created profile ===
    const editProfilePage = new EditProfilePage(authenticatedUserPage);
    await editProfilePage.waitForProfileForm();
    await expect(editProfilePage.titleInput).toHaveValue('Test User');
    await expect(authenticatedUserPage.getByText('Profile Load Error')).not.toBeVisible();
  });

  test('wizard creates profile and edit page displays it correctly', async ({
    authenticatedUserPage,
  }) => {
    await setupApiMocks(authenticatedUserPage);

    // === Walk through the 6-step wizard ===
    await walkThroughWizard(authenticatedUserPage);

    // === Profile form should load immediately with correct data ===
    const editProfilePage = new EditProfilePage(authenticatedUserPage);
    await editProfilePage.waitForProfileForm();
    await expect(editProfilePage.titleInput).toHaveValue('Test User');
    await expect(authenticatedUserPage.getByText('Profile Load Error')).not.toBeVisible();
  });
});
