import { test } from '../fixtures/regular-user-auth.fixture';
import { expect, type Page } from '@playwright/test';

/**
 * Recording a Referral Outcome from the Referral pane after Outreach: the
 * Needs outcome filter, the row's own state, and the hired badge. APIs are mocked.
 */
const submitted = new Date().toISOString();
const sentAt = new Date().toISOString();

type Outcome = 'hired' | 'not_hired' | 'not_a_fit';

const listItem = {
  id: 'req-1',
  submitted,
  estimatedDueDate: { month: '3', day: '15', year: '2027' },
  services: ['birth-doula'],
  area: 'Rochester, NY',
  responseCount: 1,
  isOpen: true,
  outreach: { sentAt },
  hiredBadge: false,
};

const detail = {
  ...listItem,
  firstName: 'Maya',
  zipcode: '14607',
  prefersSpanish: false,
  birthLocation: 'Highland Hospital',
  otherInfo: '',
  insurance: [],
  contact: { fullName: 'Maya Lopez', email: 'maya@example.com', phone: '555-0100' },
};

async function mockOutcome(page: Page, { failFirstSave = false } = {}) {
  let outcome: Outcome | undefined;
  let saveAttempts = 0;
  const saved: (Outcome | 'cleared')[] = [];

  const state = () => ({
    ...(outcome && { outcome, outcomeUpdatedAt: new Date().toISOString() }),
    hiredBadge: outcome === 'hired',
  });

  await page.route('**/api/members/*/referrals', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ referrals: [{ ...listItem, ...state() }] }),
    });
  });
  await page.route('**/api/members/*/referrals/req-1', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ...detail, ...state() }),
    });
  });
  await page.route('**/api/members/*/referrals/req-1/outcome', async (route) => {
    saveAttempts += 1;
    if (failFirstSave && saveAttempts === 1) {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Failed to save your outcome. Please try again.' }),
      });
      return;
    }
    const request = route.request();
    outcome =
      request.method() === 'DELETE'
        ? undefined
        : (request.postDataJSON() as { outcome: Outcome }).outcome;
    saved.push(outcome ?? 'cleared');
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(state()),
    });
  });

  return { saved };
}

test.describe('Referral Outcome', () => {
  test('recording, changing and clearing an outcome updates the pane and the list', async ({
    authenticatedUserPage: page,
  }) => {
    const { saved } = await mockOutcome(page);
    await page.goto('/referrals/req-1');

    const row = page.getByRole('link', { name: /Rochester, NY/ });
    await expect(row).toContainText('You reached out · Record outcome');
    await page.getByRole('button', { name: 'Needs outcome (1)' }).click();
    await expect(row).toBeVisible();

    await expect(page.getByRole('group', { name: 'Record outcome' })).toBeVisible();
    await page.getByRole('button', { name: 'Hired', exact: true }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Hired', exact: true })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await expect(page.getByRole('button', { name: 'Needs outcome (0)' })).toBeVisible();

    await page.getByRole('button', { name: 'My Outreach (1)' }).click();
    await expect(row).toContainText('You: Hired');
    await expect(row).toContainText('A member was hired');

    await page.getByRole('button', { name: 'Not a fit' }).click();
    await expect(row).toContainText('You: Not a fit');
    await expect(row).not.toContainText('A member was hired');

    await page.getByRole('button', { name: 'Clear outcome' }).click();
    await expect(page.getByText('Outcome cleared')).toBeVisible();
    await expect(row).toContainText('You reached out · Record outcome');
    expect(saved).toEqual(['hired', 'not_a_fit', 'cleared']);
  });

  test('a failed save keeps the previous outcome and can be retried', async ({
    authenticatedUserPage: page,
  }) => {
    const { saved } = await mockOutcome(page, { failFirstSave: true });
    await page.goto('/referrals/req-1');

    await page.getByRole('button', { name: 'Not hired' }).click();
    await expect(page.getByRole('alert')).toHaveText(
      'Failed to save your outcome. Please try again.',
    );
    await expect(page.getByRole('button', { name: 'Not hired' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );

    await page.getByRole('button', { name: 'Not hired' }).click();
    await expect(page.getByText('Saved', { exact: true })).toBeVisible();
    expect(saved).toEqual(['not_hired']);
  });
});
