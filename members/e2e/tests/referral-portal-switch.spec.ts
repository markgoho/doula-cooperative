import { test } from '../fixtures/regular-user-auth.fixture';
import { expect, type Page } from '@playwright/test';
import type { ApiMemberResponse } from '../../src/app/api-types/members-api.types';

/**
 * Referral Portal v2 switch, as seen by an ordinary active member.
 * The members app never reads the switch: it relies on
 * `referralPortalAvailable` from GET /api/members/:memberId and on the
 * 403 `REFERRAL_PORTAL_DISABLED` code from the referral endpoints.
 */
const activeMember: ApiMemberResponse = {
  uid: 'test-user-uid',
  email: 'test-user@doulacooperative.com',
  name: 'Test User',
  createdAt: '2024-01-01T00:00:00.000Z',
  isAdmin: false,
  subscriptionStart: '2024-01-01T00:00:00.000Z',
  membershipActive: true,
  stripeCustomerId: 'cus_123',
  stripeSubscriptionId: 'sub_123',
  subscriptionStatus: 'active',
  slug: 'test-user',
};

async function mockMember(page: Page, member: ApiMemberResponse) {
  await page.route('**/api/members/*', async (route) => {
    await (route.request().method() === 'GET'
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(member),
        })
      : route.continue());
  });
}

async function mockReferralsForbidden(page: Page, body: Record<string, string>) {
  await page.route('**/api/members/*/referrals', async (route) => {
    await route.fulfill({
      status: 403,
      contentType: 'application/json',
      body: JSON.stringify(body),
    });
  });
}

test.describe('Referral Portal v2 switch', () => {
  test('active member sees no referrals link while the portal is unavailable', async ({
    authenticatedUserPage,
  }) => {
    await mockMember(authenticatedUserPage, { ...activeMember, referralPortalAvailable: false });

    await authenticatedUserPage.goto('/membership');

    await expect(
      authenticatedUserPage.getByRole('heading', { name: 'Member Community' }),
    ).toBeVisible();
    await expect(authenticatedUserPage.getByRole('link', { name: 'View Referrals' })).toHaveCount(
      0,
    );
  });

  test('active member sees the referrals link once the portal is available', async ({
    authenticatedUserPage,
  }) => {
    await mockMember(authenticatedUserPage, { ...activeMember, referralPortalAvailable: true });

    await authenticatedUserPage.goto('/membership');

    await expect(authenticatedUserPage.getByRole('link', { name: 'View Referrals' })).toBeVisible();
  });

  test('direct visit to /referrals while disabled shows a friendly not-available state', async ({
    authenticatedUserPage,
  }) => {
    await mockMember(authenticatedUserPage, activeMember);
    await mockReferralsForbidden(authenticatedUserPage, {
      error: 'The referral portal is not available yet',
      code: 'REFERRAL_PORTAL_DISABLED',
    });

    await authenticatedUserPage.goto('/referrals');

    await expect(
      authenticatedUserPage.getByRole('heading', { name: "Referrals aren't available yet" }),
    ).toBeVisible();
    await expect(authenticatedUserPage.getByRole('alert')).toHaveCount(0);
  });

  test('lapsed membership 403 still shows the membership message', async ({
    authenticatedUserPage,
  }) => {
    await mockMember(authenticatedUserPage, activeMember);
    await mockReferralsForbidden(authenticatedUserPage, {
      error: 'Active membership required to view referrals',
      code: 'ACTIVE_MEMBERSHIP_REQUIRED',
    });

    await authenticatedUserPage.goto('/referrals');

    await expect(authenticatedUserPage.getByRole('alert')).toContainText(
      'Your membership is not currently active',
    );
  });
});
