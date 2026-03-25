import { test } from '../fixtures/regular-user-auth.fixture';
import { expect, type Page } from '@playwright/test';
import type { ProfileData } from '../../src/app/types/profile-data';
import { EditProfilePage } from '../pages/edit-profile.page';
import type { ApiMemberResponse } from '../../src/app/api-types/members-api.types';

/**
 * Mock profile data matching the new Elysia API JSON response format.
 * This represents what GET /api/profiles/:slug returns.
 */
const mockProfileData: ProfileData = {
  title: 'Test User',
  bio: 'I am a certified birth doula with 5 years of experience supporting families in the Rochester area. I provide compassionate, evidence-based support throughout pregnancy, birth, and the postpartum period.',
  pronouns: 'she/her',
  credentials: 'CD(DONA), CPD',
  tags: ['birth-doula', 'postpartum', 'lactation-support'],
  contact: {
    email: 'test-user@doulacooperative.com',
    phone: '555-0123',
    website: 'https://testdoula.example.com',
    business_name: 'Test Doula Services',
  },
  draft: false,
  image: 'https://example.com/profiles/test-user-profile-600.avif',
};

/**
 * Mock member document returned by GET /api/members/:memberId.
 * MembershipService uses this endpoint to get membershipActive and slug.
 * All timestamp fields are ISO 8601 strings (as returned by the Elysia API).
 */
const mockMemberDocument: ApiMemberResponse = {
  uid: 'test-user-uid',
  email: 'test-user@doulacooperative.com',
  name: 'Test User',
  createdAt: '2024-01-01T00:00:00.000Z',
  isAdmin: false,
  subscriptionStart: '2024-01-01T00:00:00.000Z',
  membershipActive: true,
  allowProfileEditing: true,
  slug: 'test-user',
  profileCreatedAt: '2024-01-02T00:00:00.000Z',
};

function setupApiMocks(page: Page, userSlug: string) {
  return Promise.all([
    page.route('**/api/members/*', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMemberDocument),
          })
        : route.continue());
    }),
    page.route(`**/api/profiles/${userSlug}`, async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockProfileData),
          })
        : route.continue());
    }),
  ]);
}

async function goToEditProfile(page: Page) {
  await page.goto('/membership');
  await page.getByRole('link', { name: 'Edit Profile' }).click();
}

test.describe('View Profile', () => {
  /**
   * Tests the edit profile page with properly mocked API endpoints.
   * Uses regular-user-auth.fixture for non-admin user (test-user@doulacooperative.com).
   * Mocks:
   * - GET /api/members/:memberId (MembershipService - provides membershipActive + slug)
   * - GET /api/profiles/:slug (ProfileService - loads profile data)
   * - PUT /api/profiles/:slug (ProfileService - saves profile updates)
   */

  test('user views their profile page', async ({ authenticatedUserPage }) => {
    const userSlug = 'test-user';

    await setupApiMocks(authenticatedUserPage, userSlug);

    const editProfilePage = new EditProfilePage(authenticatedUserPage);
    await goToEditProfile(authenticatedUserPage);
    await editProfilePage.waitForProfileForm();

    // === Verify Page Structure ===
    await expect(editProfilePage.pageHeading).toBeVisible();
    await expect(editProfilePage.saveButton).toBeVisible();
    await expect(editProfilePage.cancelButton).toBeVisible();

    // === Verify Profile Data Loaded from API ===
    await expect(editProfilePage.titleInput).toHaveValue('Test User');
    await expect(editProfilePage.bioTextarea).toHaveValue(
      'I am a certified birth doula with 5 years of experience supporting families in the Rochester area. I provide compassionate, evidence-based support throughout pregnancy, birth, and the postpartum period.',
    );
    await expect(editProfilePage.pronounsInput).toHaveValue('she/her');
    await expect(editProfilePage.credentialsInput).toHaveValue('CD(DONA), CPD');

    // === Verify Contact Information ===
    await expect(editProfilePage.emailInput).toHaveValue('test-user@doulacooperative.com');
    await expect(editProfilePage.phoneInput).toHaveValue('555-0123');
    await expect(editProfilePage.websiteInput).toHaveValue('https://testdoula.example.com');
    await expect(editProfilePage.businessNameInput).toHaveValue('Test Doula Services');
  });
});
