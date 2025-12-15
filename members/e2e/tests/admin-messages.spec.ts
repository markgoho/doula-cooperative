import { test } from '../fixtures/auth-emulator.fixture';
import { expect } from '@playwright/test';
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
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Messages', level: 1 }),
    ).toBeVisible();

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

  test('admin views single message details', async ({ authenticatedAdminPage }) => {
    const messageId = 'message-1';
    const firstMessage = mockMessages[0]!;

    // Mock the list endpoint for navigation
    await authenticatedAdminPage.route('**/api/admin/messages?*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          messages: mockMessages,
          total: 2,
          pendingCount: 1,
          processedCount: 1,
        }),
      });
    });

    // Mock the single message endpoint
    await authenticatedAdminPage.route(`**/api/admin/messages/${messageId}`, async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(firstMessage),
      });
    });

    // Navigate to message detail page
    await authenticatedAdminPage.goto(`/admin/messages/${messageId}`);

    // Verify page heading
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Message Details', level: 1 }),
    ).toBeVisible();

    // Verify contact details section
    await expect(
      authenticatedAdminPage.getByRole('heading', { name: 'Contact Details' }),
    ).toBeVisible();
    await expect(authenticatedAdminPage.getByText(firstMessage.contactName)).toBeVisible();
    await expect(authenticatedAdminPage.getByText(firstMessage.email)).toBeVisible();

    // Verify message content section
    await expect(authenticatedAdminPage.getByRole('heading', { name: 'Message', level: 2 })).toBeVisible();
    await expect(authenticatedAdminPage.getByText(firstMessage.message)).toBeVisible();

    // Verify status tag shows "Pending" for unsent messages
    await expect(authenticatedAdminPage.getByText('Pending')).toBeVisible();

    // Verify reCAPTCHA score is displayed
    await expect(authenticatedAdminPage.getByText('0.9')).toBeVisible();
  });

  test('admin marks message as processed', async ({ authenticatedAdminPage }) => {
    const messageId = 'message-1';
    const pendingMessage = { ...mockMessages[0], sent: false };

    // Mock the single message endpoint
    await authenticatedAdminPage.route(`**/api/admin/messages/${messageId}`, async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify(pendingMessage),
        });
      } else if (route.request().method() === 'PATCH') {
        // Mock the update endpoint
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({ success: true }),
        });
      }
    });

    // Navigate to message detail page
    await authenticatedAdminPage.goto(`/admin/messages/${messageId}`);

    // Verify "Mark as Processed" button is visible
    const markProcessedButton = authenticatedAdminPage.getByRole('button', {
      name: 'Mark as Processed',
    });
    await expect(markProcessedButton).toBeVisible();

    // Click the button
    await markProcessedButton.click();

    // Verify confirmation dialog appears
    const dialog = authenticatedAdminPage.locator('dialog');
    await expect(dialog).toBeVisible();

    // Confirm the action
    await dialog.getByRole('button', { name: 'Confirm' }).click();

    // Verify success message appears
    await expect(authenticatedAdminPage.getByText('Message marked as processed')).toBeVisible();
  });

  test('handles error when viewing non-existent message', async ({ authenticatedAdminPage }) => {
    const messageId = 'non-existent-id';

    // Mock 404 error
    await authenticatedAdminPage.route(`**/api/admin/messages/${messageId}`, async (route) => {
      await route.fulfill({
        status: 404,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Message not found' }),
      });
    });

    await authenticatedAdminPage.goto(`/admin/messages/${messageId}`);

    // Verify error message appears
    await expect(authenticatedAdminPage.getByText('Failed to load message details. Please try again.')).toBeVisible();
  });
});
