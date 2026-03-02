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

function mockMembersRoute(page: import('@playwright/test').Page) {
  return page.route('**/api/members/*', async (route) => {
    await (route.request().method() === 'GET'
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMemberDocument),
        })
      : route.continue());
  });
}

async function fillAndSubmitCreateForm(page: import('@playwright/test').Page) {
  await page.goto('/profile/create');
  await page
    .getByRole('heading', { name: /Create Your Doula Profile/i, level: 1 })
    .waitFor({ state: 'visible' });

  await page.getByLabel(/^Name/i).fill('Test User');
  await page.getByLabel(/Bio/i).fill('I am a test doula with experience.');
  await page.getByLabel('Birth Doula').check();
  await page.getByRole('button', { name: /Create Profile/i }).click();

  await expect(page.getByText(/Profile created successfully/i)).toBeVisible({
    timeout: 10_000,
  });

  await page.waitForURL('/profile', { timeout: 10_000 });
}

test.describe('Create Profile → Edit Profile Flow', () => {
  test('auto-retries and loads profile when GET initially returns 404', async ({
    authenticatedUserPage,
  }) => {
    let getProfileCount = 0;

    await mockMembersRoute(authenticatedUserPage);

    await authenticatedUserPage.route('**/api/profiles/test-user', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else if (method === 'GET') {
        getProfileCount++;
        await route.fulfill(
          getProfileCount <= 2
            ? {
                status: 404,
                contentType: 'application/json',
                body: JSON.stringify({ error: 'Profile not found' }),
              }
            : {
                status: 200,
                contentType: 'application/json',
                body: JSON.stringify(mockProfileData),
              },
        );
      } else {
        await route.continue();
      }
    });

    // === Create profile and navigate to edit ===
    await fillAndSubmitCreateForm(authenticatedUserPage);

    // === Auto-retry should eventually load the profile form ===
    const editProfilePage = new EditProfilePage(authenticatedUserPage);
    await editProfilePage.waitForProfileForm();
    await expect(editProfilePage.titleInput).toHaveValue('Test User');
    await expect(authenticatedUserPage.getByText('Profile Load Error')).not.toBeVisible();
  });

  test('loads profile form immediately when GET returns 200', async ({ authenticatedUserPage }) => {
    await mockMembersRoute(authenticatedUserPage);

    await authenticatedUserPage.route('**/api/profiles/test-user', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
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
    });

    // === Create profile and navigate to edit ===
    await fillAndSubmitCreateForm(authenticatedUserPage);

    // === Profile form should load immediately ===
    const editProfilePage = new EditProfilePage(authenticatedUserPage);
    await editProfilePage.waitForProfileForm();
    await expect(editProfilePage.titleInput).toHaveValue('Test User');
    await expect(authenticatedUserPage.getByText('Profile Load Error')).not.toBeVisible();
  });

  test('shows sync-pending banner when all auto-retries are exhausted after create', async ({
    authenticatedUserPage,
  }) => {
    await mockMembersRoute(authenticatedUserPage);

    // === GET always returns 404 ===
    await authenticatedUserPage.route('**/api/profiles/test-user', async (route) => {
      const method = route.request().method();
      if (method === 'POST') {
        await route.fulfill({
          status: 201,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else if (method === 'GET') {
        await route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({ error: 'Profile not found' }),
        });
      } else {
        await route.continue();
      }
    });

    // === Create profile and navigate to edit ===
    await fillAndSubmitCreateForm(authenticatedUserPage);

    // === After retries exhaust, form should remain visible with optimistic data ===
    const editProfilePage = new EditProfilePage(authenticatedUserPage);
    await editProfilePage.waitForProfileForm();
    await expect(editProfilePage.titleInput).toHaveValue('Test User');

    // === Sync-pending info banner should appear ===
    await expect(
      authenticatedUserPage.getByText(/will appear on the public site shortly/i),
    ).toBeVisible({ timeout: 15_000 });

    // === Error UI should NOT be shown ===
    await expect(authenticatedUserPage.getByText('Profile Load Error')).not.toBeVisible();
  });
});
