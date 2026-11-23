import { test } from '../fixtures/regular-user-auth.fixture';
import { expect, type Page } from '@playwright/test';

/**
 * v2 Referral inbox: the list on the left, the selected Referral on the right.
 * API responses are mocked; the detail payload is the pre-Outreach view.
 */
const submitted = new Date().toISOString();

const referrals = [
  {
    id: 'req-1',
    submitted,
    estimatedDueDate: { month: '3', day: '15', year: '2027' },
    services: ['birth-doula'],
    area: 'Rochester, NY',
    responseCount: 0,
    isOpen: true,
  },
  {
    id: 'req-2',
    submitted,
    estimatedDueDate: { month: '5', day: '2', year: '2027' },
    services: ['postpartum-doula'],
    area: 'Buffalo, NY',
    responseCount: 0,
    isOpen: true,
  },
];

const details: Record<string, unknown> = {
  'req-1': {
    ...referrals[0],
    firstName: 'Maya',
    zipcode: '14607',
    prefersSpanish: false,
    birthLocation: 'Highland Hospital',
    otherInfo: '',
    insurance: ['Medicaid'],
  },
  'req-2': {
    ...referrals[1],
    firstName: 'Ana',
    zipcode: '14201',
    prefersSpanish: true,
    birthLocation: '',
    otherInfo: '',
    insurance: [],
  },
};

async function mockReferrals(page: Page) {
  await page.route('**/api/members/*/referrals', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ referrals }),
    });
  });
  await page.route('**/api/members/*/referrals/*', async (route) => {
    const id = new URL(route.request().url()).pathname.split('/').at(-1) ?? '';
    const detail = details[id];
    await (detail
      ? route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(detail),
        })
      : route.fulfill({
          status: 404,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'This referral is no longer open',
            code: 'REFERRAL_NOT_OPEN',
          }),
        }));
  });
}

test.describe('Referral inbox', () => {
  test('a Referral link opens the inbox with that Referral selected', async ({
    authenticatedUserPage: page,
  }) => {
    await mockReferrals(page);

    await page.goto('/referrals/req-1');

    await expect(page).toHaveURL(/\/referrals\/open\/req-1$/);
    await expect(page.getByRole('heading', { name: 'Maya · Rochester, NY' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Rochester, NY/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    await expect(
      page.getByText("Maya's full name, email, and phone appear after you send Outreach."),
    ).toBeVisible();
  });

  test('choosing another row selects it in the pane', async ({ authenticatedUserPage: page }) => {
    await mockReferrals(page);
    await page.goto('/referrals');

    await page.getByRole('link', { name: /Buffalo, NY/ }).click();

    await expect(page).toHaveURL(/\/referrals\/open\/req-2$/);
    await expect(page.getByRole('heading', { name: 'Ana · Buffalo, NY' })).toBeVisible();
    await expect(page.getByText('Requester prefers Spanish')).toBeVisible();
  });

  test('a Referral past its window says it is no longer open', async ({
    authenticatedUserPage: page,
  }) => {
    await mockReferrals(page);

    await page.goto('/referrals/req-old');

    await expect(
      page.getByRole('heading', { name: 'This referral is no longer open' }),
    ).toBeVisible();
    await page.getByRole('link', { name: 'See open referrals' }).click();
    await expect(page).toHaveURL(/\/referrals\/open$/);
  });

  test('panes stack on a narrow screen', async ({ authenticatedUserPage: page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await mockReferrals(page);

    await page.goto('/referrals/req-1');

    const row = page.getByRole('link', { name: /Rochester, NY/ });
    const heading = page.getByRole('heading', { name: 'Maya · Rochester, NY' });
    await expect(heading).toBeVisible();
    const rowBox = await row.boundingBox();
    const headingBox = await heading.boundingBox();
    expect(headingBox?.y ?? 0).toBeGreaterThan((rowBox?.y ?? 0) + (rowBox?.height ?? 0));
  });
});
