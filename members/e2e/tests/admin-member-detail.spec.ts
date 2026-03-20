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

  test.skip('admin views member profile content', async ({ authenticatedAdminPage }) => {
    // Mock admin API endpoints
    await authenticatedAdminPage.route('**/api/admin/**', async (route) => {
      const url = route.request().url();
      const method = route.request().method();

      // GET member profile (new admin endpoint)
      if (url.includes('/api/admin/members/test-member-123/profile') && method === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            slug: 'test-member',
            profile: mockProfileData,
          }),
        });
        return;
      }

      // GET single member
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

    // === Profile section actions ===
    const profileHeading = authenticatedAdminPage.getByRole('heading', { name: 'Profile' });
    await expect(profileHeading).toBeVisible();

    const profileSection = profileHeading.locator('..');
    const loadProfileStatusButton = profileSection.getByRole('button', {
      name: 'Load Profile Status',
    });

    await expect(loadProfileStatusButton).toBeVisible();

    // === Load profile status on detail page ===
    await loadProfileStatusButton.click();
    await expect(profileSection.getByText('Published')).toBeVisible();

    const editProfileLink = profileSection.getByRole('link', { name: 'Edit Profile' });

    await expect(editProfileLink).toBeVisible();
    await expect(editProfileLink).toHaveAttribute(
      'href',
      '/admin/members/test-member-123/profile/edit',
    );

    const publicProfileLink = authenticatedAdminPage
      .getByText('Has Profile:')
      .locator('..')
      .getByRole('link', { name: 'View Profile' });
    await expect(publicProfileLink).toBeVisible();
    await expect(publicProfileLink).toHaveAttribute(
      'href',
      'https://doulacooperative.com/doulas/test-member',
    );

    const previewPageUrl = '/admin/members/test-member-123/profile';
    await authenticatedAdminPage.goto(previewPageUrl);
    await authenticatedAdminPage.waitForURL('**/admin/members/test-member-123/profile');

    // === Navigate to edit page from detail page ===
    await editProfileLink.click();
    await authenticatedAdminPage.waitForURL('**/admin/members/test-member-123/profile/edit');
    await expect(authenticatedAdminPage.getByRole('heading', { name: 'Edit Profile' })).toBeVisible();

    // === Navigate to preview page from detail page ===
    await authenticatedAdminPage.goBack();
    await authenticatedAdminPage.waitForURL('**/admin/members/test-member-123');
    await authenticatedAdminPage
      .getByRole('heading', { name: 'Profile' })
      .locator('..')
      .getByRole('link', { name: 'View Profile' })
      .click();
    await authenticatedAdminPage.waitForURL('**/admin/members/test-member-123/profile');

    // === Preview page content ===
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Profile Preview' }),
    ).toBeVisible();
    await expect(
      authenticatedAdminPage.getByRole('link', { name: 'Back to Member' }),
    ).toBeVisible();
    await expect(
      authenticatedAdminPage.getByRole('link', { name: 'Edit Profile' }),
    ).toBeVisible();

    const profileImage = authenticatedAdminPage.getByRole('img', {
      name: /Test Member|Birth Doula/i,
    });
    await expect(profileImage).toBeVisible();
    await expect(profileImage).toHaveAttribute('src', mockProfileData.image!);

    await expect(authenticatedAdminPage.getByText(mockProfileData.title)).toBeVisible();
    await expect(authenticatedAdminPage.getByText(mockProfileData.bio)).toBeVisible();
    await expect(authenticatedAdminPage.getByText(mockProfileData.credentials!)).toBeVisible();
    await expect(authenticatedAdminPage.getByText(mockProfileData.pronouns!)).toBeVisible();
    await expect(authenticatedAdminPage.getByText('birth-doula')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('postpartum-support')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('test.doula@example.com')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('555-0123')).toBeVisible();

    // === Navigate between preview and edit ===
    await authenticatedAdminPage.getByRole('link', { name: 'Edit Profile' }).click();
    await authenticatedAdminPage.waitForURL('**/admin/members/test-member-123/profile/edit');
    await expect(authenticatedAdminPage.getByRole('heading', { name: 'Edit Profile' })).toBeVisible();

    await authenticatedAdminPage.goBack();
    await authenticatedAdminPage.waitForURL('**/admin/members/test-member-123/profile');
    await authenticatedAdminPage.getByRole('link', { name: 'Back to Member' }).click();
    await authenticatedAdminPage.waitForURL('**/admin/members/test-member-123');
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Member Details' }),
    ).toBeVisible();
  });
});
