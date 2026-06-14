import { expect } from '@playwright/test';
import { test } from '../fixtures/admin-auth.fixture';
import type {
  CostOffsetRateResponse,
  MatchRequestLocationsResponse,
  MemberSignupsResponse,
  TopPagesResponse,
} from '../../src/app/admin/api-types/analytics-api.types';

const mockSignups: MemberSignupsResponse = {
  days: [
    { date: '2026-06-01', count: 2 },
    { date: '2026-06-02', count: 1 },
    { date: '2026-06-03', count: 0 },
  ],
};

const mockCostOffset: CostOffsetRateResponse = {
  withOffset: 4,
  total: 10,
  rate: 0.4,
};

const mockLocations: MatchRequestLocationsResponse = {
  locations: [
    { zip: '14620', city: 'Rochester', state: 'NY', lat: 43.13, lng: -77.61, count: 5 },
  ],
  unmapped: 2,
};

const mockTopPages: TopPagesResponse = {
  pages: [
    { title: 'Home', path: '/', views: 800 },
    { title: 'Doulas', path: '/doulas/', views: 400 },
  ],
};

test.describe('Admin Analytics Page', () => {
  test.beforeEach(async ({ authenticatedAdminPage }) => {
    await authenticatedAdminPage.route('**/api/analytics/member-signups', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockSignups),
      });
    });

    await authenticatedAdminPage.route('**/api/analytics/cost-offset-rate', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockCostOffset),
      });
    });

    await authenticatedAdminPage.route(
      '**/api/analytics/match-request-locations',
      async (route) => {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(mockLocations),
        });
      },
    );

    await authenticatedAdminPage.route('**/api/analytics/top-pages', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(mockTopPages),
      });
    });
  });

  test('renders all three sections with headings', async ({ authenticatedAdminPage }) => {
    await authenticatedAdminPage.goto('/admin/analytics');

    await expect(authenticatedAdminPage.getByRole('heading', { name: 'Analytics' })).toBeVisible();
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Membership' }),
    ).toBeVisible();
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Match Requests' }),
    ).toBeVisible();
    await expect(authenticatedAdminPage.getByRole('heading', { name: 'Website' })).toBeVisible();
  });

  test('signups bar chart renders day bars', async ({ authenticatedAdminPage }) => {
    await authenticatedAdminPage.goto('/admin/analytics');

    // Bar chart days from mock — days 01, 02, 03
    await expect(authenticatedAdminPage.locator('.bar-chart')).toBeVisible();
    await expect(authenticatedAdminPage.locator('.bar-col')).toHaveCount(3);
  });

  test('cost offset stat card renders stat text', async ({ authenticatedAdminPage }) => {
    await authenticatedAdminPage.goto('/admin/analytics');

    await expect(
      authenticatedAdminPage.getByText('selected a Cost Offset in the last 30 days'),
    ).toBeVisible();
    await expect(authenticatedAdminPage.getByText(/4 of 10/)).toBeVisible();
  });

  test('top pages list renders page entries', async ({ authenticatedAdminPage }) => {
    await authenticatedAdminPage.goto('/admin/analytics');

    await expect(authenticatedAdminPage.getByText('Home')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('800 views')).toBeVisible();
  });

  test('map renders container with unmapped footnote', async ({ authenticatedAdminPage }) => {
    await authenticatedAdminPage.goto('/admin/analytics');

    await expect(authenticatedAdminPage.locator('.map-container')).toBeVisible();
    await expect(
      authenticatedAdminPage.getByText(/2 request\(s\) could not be mapped/),
    ).toBeVisible();
  });

  test('error in signups card does not break other cards', async ({ authenticatedAdminPage }) => {
    // Override signups to return error
    await authenticatedAdminPage.route('**/api/analytics/member-signups', async (route) => {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'server error' }) });
    });

    await authenticatedAdminPage.goto('/admin/analytics');

    await expect(
      authenticatedAdminPage.getByText('Failed to load member signups.'),
    ).toBeVisible();
    // Other cards still load
    await expect(
      authenticatedAdminPage.getByText('selected a Cost Offset in the last 30 days'),
    ).toBeVisible();
    await expect(authenticatedAdminPage.getByText('Home')).toBeVisible();
  });

  test('error in cost offset card does not break other cards', async ({
    authenticatedAdminPage,
  }) => {
    await authenticatedAdminPage.route('**/api/analytics/cost-offset-rate', async (route) => {
      await route.fulfill({ status: 500, body: JSON.stringify({ error: 'server error' }) });
    });

    await authenticatedAdminPage.goto('/admin/analytics');

    await expect(authenticatedAdminPage.getByText('Failed to load cost offset data.')).toBeVisible();
    await expect(authenticatedAdminPage.locator('.bar-chart')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('Home')).toBeVisible();
  });

  test('analytics card on dashboard links to analytics page', async ({
    authenticatedAdminPage,
  }) => {
    await authenticatedAdminPage.goto('/admin');
    await authenticatedAdminPage.getByRole('link', { name: /Analytics/ }).click();
    await expect(authenticatedAdminPage).toHaveURL(/\/admin\/analytics/);
  });
});
