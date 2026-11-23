import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReferralsService, type ReferralListItem } from '../services/referrals.service';
import { MembershipRequiredError } from './membership-required-error';
import { ReferralListRefresh } from './referral-list-refresh';
import { ReferralPortalDisabledError } from './referral-portal-disabled-error';
import { Referrals } from './referrals';

function makeReferral(overrides: Partial<ReferralListItem> = {}): ReferralListItem {
  return {
    id: 'req-1',
    submitted: new Date().toISOString(),
    estimatedDueDate: { month: '3', day: '15', year: '2027' },
    services: ['birth-doula'],
    area: 'Rochester, NY',
    responseCount: 0,
    isOpen: true,
    ...overrides,
  };
}

async function setup({
  loading = false,
  failure,
  referrals = [] as ReferralListItem[],
}: {
  loading?: boolean;
  failure?: Error;
  referrals?: ReferralListItem[];
} = {}) {
  let listReferrals: ReturnType<typeof vi.fn>;
  if (loading) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    listReferrals = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
  } else if (failure) {
    listReferrals = vi.fn().mockRejectedValue(failure);
  } else {
    listReferrals = vi.fn().mockResolvedValue(referrals);
  }

  await render(Referrals, {
    providers: [{ provide: ReferralsService, useValue: { listReferrals } }, provideRouter([])],
  });

  return { listReferrals, listRefresh: TestBed.inject(ReferralListRefresh) };
}

describe('Referrals inbox', () => {
  it('shows a loading message while fetching', async () => {
    await setup({ loading: true });
    expect(await screen.findByRole('status')).toHaveTextContent('Loading referrals...');
  });

  it('shows an error message on failure', async () => {
    await setup({ failure: new Error('Network error') });
    expect(await screen.findByRole('alert')).toHaveTextContent('Network error');
  });

  it('shows a friendly not-available state while the portal is off', async () => {
    await setup({ failure: new ReferralPortalDisabledError() });
    expect(
      await screen.findByRole('heading', { name: "Referrals aren't available yet" }),
    ).toBeVisible();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.getByRole('link', { name: 'Back to your membership' })).toHaveAttribute(
      'href',
      '/membership',
    );
  });

  it('asks a lapsed member for an active membership, linking to /membership', async () => {
    await setup({ failure: new MembershipRequiredError() });
    expect(
      await screen.findByRole('heading', { name: 'Active membership required' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'Go to your membership' })).toHaveAttribute(
      'href',
      '/membership',
    );
    expect(screen.queryByRole('list', { name: 'Referrals' })).toBeNull();
  });

  it('frames Referrals as open for 14 days', async () => {
    await setup();
    expect(await screen.findByText(/open for 14 days/i)).toBeVisible();
  });

  it('shows an empty state when no Referrals are open', async () => {
    await setup();
    expect(await screen.findByText('No open referrals right now. Check back soon.')).toBeVisible();
  });

  it('offers the Open filter with its count, selected', async () => {
    await setup({ referrals: [makeReferral(), makeReferral({ id: 'req-2' })] });
    expect(await screen.findByRole('button', { name: 'Open (2)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
  });

  it('lists each Referral with area, due date, services, submitted and responses', async () => {
    await setup({
      referrals: [makeReferral({ services: ['birth-doula', 'postpartum-doula'] })],
    });
    const row = await screen.findByRole('link', { name: /Rochester, NY/ });
    expect(row).toHaveTextContent('Due Mar 15, 2027 · Birth, Postpartum');
    expect(row).toHaveTextContent('Today');
    expect(row).toHaveTextContent('No one has responded yet');
  });

  it('counts members who responded', async () => {
    await setup({ referrals: [makeReferral({ responseCount: 3 })] });
    expect(await screen.findByText('3 members responded')).toBeVisible();
  });

  it('links each row to its Referral', async () => {
    await setup({ referrals: [makeReferral({ id: 'req-abc' })] });
    expect(await screen.findByRole('link', { name: /Rochester, NY/ })).toHaveAttribute(
      'href',
      '/referrals/req-abc',
    );
  });

  it('keeps older reached-out Referrals out of Open', async () => {
    await setup({
      referrals: [
        makeReferral({ id: 'req-open' }),
        makeReferral({
          id: 'req-old',
          area: 'Buffalo, NY',
          isOpen: false,
          outreach: { sentAt: new Date().toISOString() },
        }),
      ],
    });
    expect(await screen.findByRole('button', { name: 'Open (1)' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Rochester, NY/ })).toBeVisible();
    expect(screen.queryByRole('link', { name: /Buffalo, NY/ })).toBeNull();
  });

  it('lists every Referral you reached out on under My Outreach, at any age', async () => {
    await setup({
      referrals: [
        makeReferral({ id: 'req-open' }),
        makeReferral({
          id: 'req-mine-open',
          area: 'Albany, NY',
          outreach: { sentAt: new Date().toISOString() },
        }),
        makeReferral({
          id: 'req-mine-old',
          area: 'Buffalo, NY',
          isOpen: false,
          outreach: { sentAt: new Date().toISOString() },
        }),
      ],
    });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'My Outreach (2)' }));

    expect(screen.getByRole('button', { name: 'My Outreach (2)' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByRole('link', { name: /Albany, NY/ })).toHaveTextContent('You reached out');
    expect(screen.getByRole('link', { name: /Buffalo, NY/ })).toHaveTextContent('You reached out');
    expect(screen.queryByRole('link', { name: /Rochester, NY/ })).toBeNull();
  });

  it('says when you have not sent Outreach yet', async () => {
    await setup({ referrals: [makeReferral()] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('button', { name: 'My Outreach (0)' }));
    expect(screen.getByText("You haven't sent Outreach yet.")).toBeVisible();
  });

  it('reloads the list when the pane reports sent Outreach', async () => {
    const { listReferrals, listRefresh } = await setup({ referrals: [makeReferral()] });
    await screen.findByRole('link', { name: /Rochester, NY/ });
    listReferrals.mockResolvedValue([
      makeReferral({ responseCount: 1, outreach: { sentAt: new Date().toISOString() } }),
    ]);

    listRefresh.request();

    expect(await screen.findByText('You reached out')).toBeVisible();
    expect(screen.getByText('1 member responded')).toBeVisible();
  });

  it('handles a Referral with no area or due date', async () => {
    await setup({
      referrals: [makeReferral({ area: '', estimatedDueDate: { month: '', day: '', year: '' } })],
    });
    const row = await screen.findByRole('link', { name: /Area not provided/ });
    expect(row).toHaveTextContent('Due not provided');
  });
});
