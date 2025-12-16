import { test } from '../fixtures/admin-auth.fixture';
import { expect } from '@playwright/test';
import type { MatchRequest } from '../../src/app/admin/admin.types';

/**
 * E2E tests for admin match requests page
 */
const mockMatchRequests: MatchRequest[] = [
  {
    id: 'request-1',
    name: 'Jane Doe',
    email: 'jane@example.com',
    phone: '555-1234',
    zipcode: '12345',
    estimatedDueDate: { month: '03', day: '15', year: '2025' },
    services: ['birth-doula'],
    birthLocation: 'Hospital',
    otherInfo: 'First time parent',
    insurance: ['Blue Cross'],
    submitted: '2024-12-01T10:00:00.000Z',
    sent: false,
    recaptchaScore: 0.9,
  },
  {
    id: 'request-2',
    name: 'John Smith',
    email: 'john@example.com',
    phone: '555-5678',
    zipcode: '54321',
    estimatedDueDate: { month: '04', day: '20', year: '2025' },
    services: ['postpartum-doula'],
    birthLocation: 'Home',
    otherInfo: '',
    insurance: ['Aetna'],
    submitted: '2024-11-25T14:30:00.000Z',
    sent: true,
  },
];

test.describe('Admin Match Requests Page', () => {
  test('admin views match requests list and verifies data', async ({ authenticatedAdminPage }) => {
    // Mock the match requests list endpoint using the same pattern as admin-users
    await authenticatedAdminPage.route('**/api/admin/match-requests**', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              requests: mockMatchRequests,
              total: 2,
              pendingCount: 1,
              processedCount: 1,
            }),
          })
        : route.continue());
    });

    // Navigate to match requests page
    await authenticatedAdminPage.goto('/admin/match-requests');

    // Verify page heading
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Match Requests', level: 1 }),
    ).toBeVisible();

    // Verify table has data
    const table = authenticatedAdminPage.getByRole('table');
    await expect(table).toBeVisible();

    // Verify match request data appears in table
    await expect(authenticatedAdminPage.getByText('Jane Doe')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('jane@example.com')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('John Smith')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('john@example.com')).toBeVisible();
  });

  test('handles API error with user-friendly message', async ({ authenticatedAdminPage }) => {
    // Mock API error
    await authenticatedAdminPage.route('**/api/admin/match-requests**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await authenticatedAdminPage.goto('/admin/match-requests');

    // Verify error message appears
    await expect(authenticatedAdminPage.getByRole('alert')).toBeVisible();
  });
});
