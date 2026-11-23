import { test } from '../fixtures/regular-user-auth.fixture';
import { expect, type Page } from '@playwright/test';

/**
 * Sending Outreach from the Referral pane: the composer, the reveal of the
 * requester's contact details, and the My Outreach filter. APIs are mocked.
 */
const submitted = new Date().toISOString();
const sentAt = new Date().toISOString();

const listItem = {
  id: 'req-1',
  submitted,
  estimatedDueDate: { month: '3', day: '15', year: '2027' },
  services: ['birth-doula'],
  area: 'Rochester, NY',
  responseCount: 0,
  isOpen: true,
};

const detail = {
  ...listItem,
  firstName: 'Maya',
  zipcode: '14607',
  prefersSpanish: false,
  birthLocation: 'Highland Hospital',
  otherInfo: '',
  insurance: [],
  outreachSender: {
    name: 'Dana Doula',
    email: 'dana@example.com',
    profileUrl: 'https://doulacooperative.com/doulas/dana-doula/',
  },
};

const sent = {
  outreach: { sentAt },
  contact: { fullName: 'Maya Lopez', email: 'maya@example.com', phone: '555-0100' },
};

async function mockOutreach(page: Page, { failFirstSend = false } = {}) {
  let hasSent = false;
  let sendAttempts = 0;
  const sentMessages: string[] = [];

  await page.route('**/api/members/*/referrals', async (route) => {
    const referrals = hasSent
      ? [{ ...listItem, responseCount: 1, outreach: { sentAt } }]
      : [listItem];
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ referrals }),
    });
  });
  await page.route('**/api/members/*/referrals/req-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(detail),
    });
  });
  await page.route('**/api/members/*/referrals/req-1/outreach', async (route) => {
    sendAttempts += 1;
    const body = route.request().postDataJSON() as { message: string };
    sentMessages.push(body.message);
    if (failFirstSend && sendAttempts === 1) {
      await route.fulfill({
        status: 502,
        contentType: 'application/json',
        body: JSON.stringify({
          error: "Your message wasn't sent, and nothing was shared. Please try again.",
          code: 'OUTREACH_SEND_FAILED',
        }),
      });
      return;
    }
    hasSent = true;
    await route.fulfill({
      status: 201,
      contentType: 'application/json',
      body: JSON.stringify(sent),
    });
  });

  return { sentMessages };
}

test.describe('Referral Outreach', () => {
  test('sending Outreach reveals contact details and lists the Referral under My Outreach', async ({
    authenticatedUserPage: page,
  }) => {
    const { sentMessages } = await mockOutreach(page);
    await page.goto('/referrals/req-1');

    const message = page.getByRole('textbox', { name: 'Message to Maya' });
    await expect(message).toHaveValue(/^Hi Maya,/);
    await expect(message).toHaveValue(/dana-doula/);
    await message.fill('Hi Maya, I would love to support your birth.');
    await page.getByRole('button', { name: 'Send Outreach' }).click();

    await expect(page.getByRole('heading', { name: 'Maya Lopez' })).toBeVisible();
    await expect(page.getByRole('link', { name: 'maya@example.com' })).toHaveAttribute(
      'href',
      'mailto:maya@example.com',
    );
    await expect(page.getByRole('link', { name: '555-0100' })).toBeVisible();
    await expect(page.getByText(/^You reached out /)).toBeVisible();
    await expect(page.getByRole('textbox')).toHaveCount(0);
    expect(sentMessages).toEqual(['Hi Maya, I would love to support your birth.']);

    await page.getByRole('button', { name: 'My Outreach (1)' }).click();
    await expect(page.getByRole('link', { name: /Rochester, NY/ })).toContainText(
      'You reached out',
    );
  });

  test('a failed send shares nothing and can be retried', async ({
    authenticatedUserPage: page,
  }) => {
    const { sentMessages } = await mockOutreach(page, { failFirstSend: true });
    await page.goto('/referrals/req-1');

    await page.getByRole('button', { name: 'Send Outreach' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      "Your message wasn't sent, and nothing was shared. Please try again.",
    );
    await expect(page.getByRole('heading', { name: 'Maya Lopez' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Send Outreach' }).click();
    await expect(page.getByRole('heading', { name: 'Maya Lopez' })).toBeVisible();
    expect(sentMessages).toHaveLength(2);
  });

  test('an empty message is not sent', async ({ authenticatedUserPage: page }) => {
    const { sentMessages } = await mockOutreach(page);
    await page.goto('/referrals/req-1');

    await page.getByRole('textbox', { name: 'Message to Maya' }).fill('');
    await page.getByRole('button', { name: 'Send Outreach' }).click();

    await expect(page.getByText('Write a message before sending Outreach.')).toBeVisible();
    expect(sentMessages).toEqual([]);
  });
});
