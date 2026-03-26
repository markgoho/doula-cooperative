import { test } from '../fixtures/regular-user-auth.fixture';
import { expect, type Page } from '@playwright/test';
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
  allowProfileEditing: true,
};

const mockCreatedMemberDocument: ApiMemberResponse = {
  ...mockMemberDocument,
  slug: 'test-user',
  profileCreatedAt: '2024-01-02T00:00:00.000Z',
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

function createCurrentMemberDocument(): ApiMemberResponse {
  return { ...mockMemberDocument };
}

let currentMemberDocument = createCurrentMemberDocument();

function setupApiMocks(page: Page) {
  currentMemberDocument = createCurrentMemberDocument();

  return Promise.all([
    page.route('**/api/members/*', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(currentMemberDocument),
          })
        : route.continue());
    }),
    page.route(/\/api\/profiles\/slugs\/check(\?|$)/, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ available: true }),
      });
    }),
    page.route('**/api/profiles/slugs', async (route) => {
      if (route.request().method() === 'POST') {
        currentMemberDocument = {
          ...currentMemberDocument,
          slug: 'test-user',
        };
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, slug: 'test-user' }),
        });
        return;
      }

      await route.continue();
    }),
    page.route('**/api/profiles/test-user', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        currentMemberDocument = mockCreatedMemberDocument;
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true, profile: mockProfileData }),
        });
        return;
      }

      if (method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProfileData),
        });
        return;
      }

      await route.continue();
    }),
  ]);
}

async function walkThroughWizard(page: Page) {
  await page.goto('/membership');
  await page.getByRole('button', { name: 'Create Profile' }).click();

  // === Step 1: Personal Info ===
  await page.getByRole('heading', { name: /Personal Information/i, level: 2 }).waitFor({
    state: 'visible',
  });
  await page.getByLabel(/^Name/i).fill('Test User');
  await expect(page.getByText(/Your profile URL/i)).toBeVisible({ timeout: 10_000 });
  await page.getByRole('button', { name: 'Next' }).click();

  // === Step 2: Tags ===
  await page.getByRole('heading', { name: /Services & Specialties/i, level: 2 }).waitFor({
    state: 'visible',
  });
  await page.getByLabel('Birth Doula').check();
  await page.getByRole('button', { name: 'Next' }).click();

  // === Step 3: Bio ===
  await page.getByRole('heading', { name: /About You/i, level: 2 }).waitFor({ state: 'visible' });
  await page.getByLabel(/Bio/i).fill('I am a test doula with experience.');
  await page.getByRole('button', { name: 'Next' }).click();

  // === Step 4: Contact ===
  await page.getByRole('heading', { name: /Contact Information/i, level: 2 }).waitFor({
    state: 'visible',
  });
  await page.getByRole('button', { name: 'Next' }).click();

  // === Step 5: Image (skip) ===
  await page.getByRole('heading', { name: /Profile Photo/i, level: 2 }).waitFor({
    state: 'visible',
  });
  await page.getByRole('button', { name: /Skip for now/i }).click();

  // === Step 6: Preview ===
  await page.getByRole('heading', { name: /Preview Your Profile/i, level: 2 }).waitFor({
    state: 'visible',
  });
  await page.getByRole('button', { name: 'Finish' }).click();

  await expect(page).toHaveURL(/\/profile$/);
}

test.describe('Create Profile → Edit Profile Flow', () => {
  test('walks through wizard and loads edit profile form with created data', async ({
    authenticatedUserPage,
  }) => {
    await setupApiMocks(authenticatedUserPage);
    await walkThroughWizard(authenticatedUserPage);

    const editProfilePage = new EditProfilePage(authenticatedUserPage);
    await editProfilePage.waitForProfileForm();
    await expect(editProfilePage.titleInput).toHaveValue('Test User');
    await expect(authenticatedUserPage.getByText('Profile Load Error')).not.toBeVisible();
  });

  test('wizard creates profile and edit page displays it correctly', async ({
    authenticatedUserPage,
  }) => {
    await setupApiMocks(authenticatedUserPage);
    await walkThroughWizard(authenticatedUserPage);

    const editProfilePage = new EditProfilePage(authenticatedUserPage);
    await editProfilePage.waitForProfileForm();
    await expect(editProfilePage.titleInput).toHaveValue('Test User');
    await expect(authenticatedUserPage.getByText('Profile Load Error')).not.toBeVisible();
  });
});
