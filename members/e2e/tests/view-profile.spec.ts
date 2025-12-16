import { test } from '../fixtures/regular-user-auth.fixture';
import { expect } from '@playwright/test';
import type { ProfileData } from '../../src/app/types/profile-data';
import { EditProfilePage } from '../pages/edit-profile.page';

/**
 * Mock profile data matching the new Elysia API JSON response format.
 * This represents what GET /api/profiles/me returns.
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
 * Mock member document in Firestore REST API wire format.
 * The MembershipService reads from Firestore to get membershipActive and slug.
 */
const mockMemberDocument = {
  name: 'projects/doula-cooperative/databases/(default)/documents/members/test-user-uid',
  fields: {
    email: { stringValue: 'test-user@doulacooperative.com' },
    name: { stringValue: 'Test User' },
    createdAt: { timestampValue: '2024-01-01T00:00:00.000Z' },
    subscriptionStart: { timestampValue: '2024-01-01T00:00:00.000Z' },
    membershipActive: { booleanValue: true },
    slug: { stringValue: 'test-user' },
  },
  createTime: '2024-01-01T00:00:00.000Z',
  updateTime: '2024-01-01T00:00:00.000Z',
};

test.describe.skip('View Profile', () => {
  /**
   * TODO: This test requires MembershipService to be migrated to use HTTP API.
   * Currently MembershipService uses Firestore SDK (getDoc) which requires Firestore emulator.
   * Since e2e tests only run Auth emulator, we need to either:
   * 1. Create /api/members/me endpoint and migrate MembershipService to HTTP
   * 2. Mock the Firestore SDK's HTTP calls (complex and fragile)
   *
   * Skipping until MembershipService is refactored to use REST API.
   *
   * Uses regular-user-auth.fixture for non-admin user (test-user@doulacooperative.com).
   * Mocks:
   * - Firestore REST API for member document lookup (MembershipService needs membershipActive + slug)
   * - /api/profiles/me endpoints (profiles API)
   */

  test('user views their profile page and can update profile data', async ({
    authenticatedUserPage,
  }) => {
    let profileGetCount = 0;
    let profileUpdateData: unknown;

    // Mock Firestore REST API call for member document
    // MembershipService uses getDoc() which calls the Firestore REST API
    await authenticatedUserPage.route('**/localhost:8080/**', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockMemberDocument),
      });
    });

    // Mock GET and PUT /api/profiles/me
    // The ProfileService resource will call GET multiple times (initial load + after save)
    await authenticatedUserPage.route('**/api/profiles/me', async (route) => {
      if (route.request().method() === 'GET') {
        profileGetCount++;
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockProfileData),
        });
      } else if (route.request().method() === 'PUT') {
        profileUpdateData = route.request().postDataJSON();
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      } else {
        await route.continue();
      }
    });

    const editProfilePage = new EditProfilePage(authenticatedUserPage);
    await editProfilePage.goto();
    await editProfilePage.waitForProfileForm();

    // === Verify Page Loaded and Structure ===
    await expect(editProfilePage.pageHeading).toBeVisible();
    await expect(editProfilePage.saveButton).toBeVisible();
    await expect(editProfilePage.saveButton).toBeEnabled();
    await expect(editProfilePage.cancelButton).toBeVisible();

    // === Verify Profile Data Loaded from GET /api/profiles/me ===
    // Backend now parses YAML and returns structured JSON
    await expect(editProfilePage.titleInput).toHaveValue('Test User');
    await expect(editProfilePage.bioTextarea).toHaveValue(
      'I am a certified birth doula with 5 years of experience supporting families in the Rochester area. I provide compassionate, evidence-based support throughout pregnancy, birth, and the postpartum period.',
    );
    await expect(editProfilePage.pronounsInput).toHaveValue('she/her');
    await expect(editProfilePage.credentialsInput).toHaveValue('CD(DONA), CPD');

    // === Verify All Contact Fields Loaded ===
    await expect(editProfilePage.emailInput).toHaveValue('test-user@doulacooperative.com');
    await expect(editProfilePage.phoneInput).toHaveValue('555-0123');
    await expect(editProfilePage.websiteInput).toHaveValue('https://testdoula.example.com');
    await expect(editProfilePage.businessNameInput).toHaveValue('Test Doula Services');

    // === Verify GET API Was Called ===
    expect(profileGetCount).toBeGreaterThanOrEqual(1);

    // === Update Title and Bio ===
    await editProfilePage.titleInput.fill('Test User - Senior Doula');
    await editProfilePage.bioTextarea.fill(
      'Updated: I am a DONA-certified birth and postpartum doula with over 6 years of experience. I specialize in supporting first-time parents, VBAC preparation, and families with multiples. I also provide lactation counseling and postpartum planning services.',
    );

    // === Update Credentials ===
    await editProfilePage.credentialsInput.fill('CD(DONA), CPD, CLC (Certified Lactation Counselor)');

    // === Update Contact Information ===
    await editProfilePage.phoneInput.fill('555-9876');
    await editProfilePage.emailInput.fill('updated-test@example.com');
    await editProfilePage.websiteInput.fill('https://seniortestdoula.com');
    await editProfilePage.businessNameInput.fill('Senior Test Doula Services LLC');

    // === Verify Form Reflects Changes Before Save ===
    await expect(editProfilePage.titleInput).toHaveValue('Test User - Senior Doula');
    await expect(editProfilePage.phoneInput).toHaveValue('555-9876');
    await expect(editProfilePage.emailInput).toHaveValue('updated-test@example.com');

    // === Save Profile ===
    await editProfilePage.saveProfile();

    // === Verify Success Message Appears ===
    await expect(editProfilePage.successMessage).toBeVisible();
    await expect(editProfilePage.successMessage).toContainText(/profile.*updated.*successfully/i);

    // === Verify PUT /api/profiles/me Was Called with All Updates ===
    expect(profileUpdateData).toBeDefined();
    expect(profileUpdateData).toMatchObject({
      title: 'Test User - Senior Doula',
      bio: 'Updated: I am a DONA-certified birth and postpartum doula with over 6 years of experience. I specialize in supporting first-time parents, VBAC preparation, and families with multiples. I also provide lactation counseling and postpartum planning services.',
      credentials: 'CD(DONA), CPD, CLC (Certified Lactation Counselor)',
      pronouns: 'she/her',
      tags: ['birth-doula', 'postpartum', 'lactation-support'],
      contact: {
        email: 'updated-test@example.com',
        phone: '555-9876',
        website: 'https://seniortestdoula.com',
        business_name: 'Senior Test Doula Services LLC',
      },
      draft: false,
    });

    // === Verify ProfileService Reloaded After Save ===
    // GET should be called again after successful PUT
    expect(profileGetCount).toBeGreaterThanOrEqual(2);

    // === Test Cancel Functionality ===
    // Make unsaved changes
    await editProfilePage.titleInput.fill('Unsaved Title Change');
    await expect(editProfilePage.titleInput).toHaveValue('Unsaved Title Change');

    // Cancel reverts to last loaded value
    await editProfilePage.cancelEdit();
    await expect(editProfilePage.titleInput).toHaveValue('Test User - Senior Doula');

    // === Verify Error Message Not Shown ===
    await expect(editProfilePage.errorMessage).not.toBeVisible();
  });
});
