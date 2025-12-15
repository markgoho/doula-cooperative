import { test, expect } from '../fixtures/admin-auth.fixture';
import type { Message } from '../../src/app/admin/admin.types';

/**
 * E2E tests for admin messages page
 */
const mockMessages: Message[] = [
  {
    id: 'message-1',
    contactName: 'Jane Doe',
    email: 'jane@example.com',
    message: 'I have a question about membership',
    submitted: '2024-12-01T10:00:00.000Z',
    sent: false,
    recaptchaScore: 0.9,
  },
  {
    id: 'message-2',
    contactName: 'John Smith',
    email: 'john@example.com',
    message: 'Thank you for your help',
    submitted: '2024-11-25T14:30:00.000Z',
    sent: true,
  },
];

test.describe('Admin Messages Page', () => {
  test('admin views messages list and verifies data', async ({ authenticatedAdminPage }) => {
    // Mock the messages list endpoint
    await authenticatedAdminPage.route('**/api/admin/messages**', async (route) => {
      await (route.request().method() === 'GET'
        ? route.fulfill({
            status: 200,
            contentType: 'application/json',
            body: JSON.stringify({
              messages: mockMessages,
              total: 2,
              pendingCount: 1,
              processedCount: 1,
            }),
          })
        : route.continue());
    });

    // Navigate to messages page
    await authenticatedAdminPage.goto('/admin/messages');

    // Verify page heading
    await expect(authenticatedAdminPage.getByRole('heading', { name: 'Messages', level: 1 })).toBeVisible();

    // Verify table has data
    const table = authenticatedAdminPage.getByRole('table');
    await expect(table).toBeVisible();

    // Verify message data appears
    await expect(authenticatedAdminPage.getByText('Jane Doe')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('jane@example.com')).toBeVisible();
    await expect(authenticatedAdminPage.getByText('John Smith')).toBeVisible();
  });

  test('handles API error with user-friendly message', async ({ authenticatedAdminPage }) => {
    // Mock API error
    await authenticatedAdminPage.route('**/api/admin/messages**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal server error' }),
      });
    });

    await authenticatedAdminPage.goto('/admin/messages');

    // Verify error message appears
    await expect(authenticatedAdminPage.getByRole('alert')).toBeVisible();
  });
});
