import { test } from '../fixtures/admin-auth.fixture';
import { expect } from '@playwright/test';
import type { ApiMemberResponse } from '../../src/app/api-types/members-api.types';
import type { ProfileData } from '../../src/app/types/profile-data';
import { AdminMemberDetailPage } from '../pages/admin-member-detail.page';

/**
 * E2E tests for admin member detail page operations
 */
const mockMember: ApiMemberResponse = {
  uid: 'test-member-123',
  email: 'test.member@example.com',
  name: 'Test Member',
  createdAt: '2024-01-15T10:30:00.000Z',
  isAdmin: false,
  membershipActive: true,
  subscriptionStart: '2024-01-15T10:30:00.000Z',
  membershipExpiresAt: '2025-01-15T10:30:00.000Z',
  slug: 'test-member',
};

const mockProfileData: ProfileData = {
  title: 'Test Member - Birth Doula',
  bio: 'This is my bio as a birth doula. I have been supporting families for 5 years.',
  credentials: 'CD(DONA), CPD',
  pronouns: 'she/her',
  tags: ['birth-doula', 'postpartum-support'],
  contact: {
    email: 'test.doula@example.com',
    phone: '555-0123',
  },
  image: 'https://example.com/profile-image.jpg',
};

test.describe('Admin Member Detail Page', () => {
  test('admin views member details with proper data display', async ({
    authenticatedAdminPage,
  }) => {
    // Mock GET endpoint
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      if (url.includes('/api/admin/members/test-member-123') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockMember),
        });
        return;
      }

      await route.continue();
    });

    const memberDetailPage = new AdminMemberDetailPage(authenticatedAdminPage);
    await memberDetailPage.goto('test-member-123');
    await memberDetailPage.waitForMemberDetails();

    // Verify page structure
    await expect(memberDetailPage.pageHeading).toBeVisible();

    // Verify member data using accessible selectors
    await expect(memberDetailPage.nameValue).toContainText('Test Member');
    await expect(memberDetailPage.emailValue).toContainText('test.member@example.com');
    await expect(memberDetailPage.uidValue).toContainText('test-member-123');
    await expect(memberDetailPage.membershipStatus).toContainText('Active');
  });

  test('admin performs clean slate delete on a member', async ({ authenticatedAdminPage }) => {
    const inactiveMember: ApiMemberResponse = {
      ...mockMember,
      membershipActive: false,
    };

    // Mock all API endpoints
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // GET single member
      if (
        url.includes('/api/admin/members/test-member-123') &&
        !url.includes('/clean-slate') &&
        method === 'GET'
      ) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(inactiveMember),
        });
        return;
      }

      // POST clean-slate delete
      if (url.includes('/api/admin/members/test-member-123/clean-slate') && method === 'POST') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            deletedUid: 'test-member-123',
            memberDocumentDeleted: true,
            authUserDeleted: true,
          }),
        });
        return;
      }

      // GET members list (for redirect after delete)
      if (/\/api\/admin\/members(\?|$)/.test(url) && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ members: [], total: 0 }),
        });
        return;
      }

      await route.continue();
    });

    const memberDetailPage = new AdminMemberDetailPage(authenticatedAdminPage);
    await memberDetailPage.goto('test-member-123');
    await memberDetailPage.waitForMemberDetails();

    // === Verify Clean Slate Delete Button is Visible ===
    await expect(memberDetailPage.cleanSlateDeleteButton).toBeVisible();

    // === Perform Clean Slate Delete ===
    await memberDetailPage.cleanSlateDelete();

    // === Verify Redirect to Members List ===
    await authenticatedAdminPage.waitForURL('**/admin/members');
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Members', level: 1 }),
    ).toBeVisible();
  });

  test('admin views member profile content', async ({ authenticatedAdminPage }) => {
    // Mock GET member endpoint
    await authenticatedAdminPage.route('**/api/admin/members/test-member-123', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockMember),
          })
        : route.continue());
    });

    // Mock GET profile by slug endpoint (public endpoint)
    await authenticatedAdminPage.route('**/api/profiles/test-member', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify(mockProfileData),
          })
        : route.continue());
    });

    const memberDetailPage = new AdminMemberDetailPage(authenticatedAdminPage);
    await memberDetailPage.goto('test-member-123');
    await memberDetailPage.waitForMemberDetails();

    // === Profile Section ===
    // Initially, profile content should not be visible
    const profileSection = authenticatedAdminPage.getByRole('heading', { name: 'Profile' });
    await expect(profileSection).toBeVisible();

    // Verify "View Profile Content" button is visible
    const viewProfileButton = authenticatedAdminPage.getByRole('button', {
      name: /View Profile Content/i,
    });
    await expect(viewProfileButton).toBeVisible();

    // === Load Profile ===
    // Click button to load profile
    await viewProfileButton.click();

    // === Profile Content Display ===
    // Wait for profile content to load (loading happens too fast with mocked data)
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Profile Content' }),
    ).toBeVisible();

    // Verify profile image is displayed
    const profileImage = authenticatedAdminPage.getByRole('img', {
      name: /Test Member|Profile image/i,
    });
    await expect(profileImage).toBeVisible();
    await expect(profileImage).toHaveAttribute('src', mockProfileData.image!);

    // Verify profile data fields are displayed
    await expect(authenticatedAdminPage.getByText(mockProfileData.title)).toBeVisible();
    await expect(authenticatedAdminPage.getByText(mockProfileData.bio)).toBeVisible();
    await expect(authenticatedAdminPage.getByText(mockProfileData.credentials!)).toBeVisible();
    await expect(authenticatedAdminPage.getByText(mockProfileData.pronouns!)).toBeVisible();
    await expect(authenticatedAdminPage.getByText('birth-doula, postpartum-support')).toBeVisible();

    // Verify contact information
    await expect(authenticatedAdminPage.getByText('test.doula@example.com')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('555-0123')).toBeVisible();
  });
});
