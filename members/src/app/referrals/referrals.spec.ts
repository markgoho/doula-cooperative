import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  RouterOutlet,
  provideRouter,
  withComponentInputBinding,
  type Routes,
} from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ReferralsService, type ReferralListItem } from '../services/referrals.service';
import { MembershipRequiredError } from './membership-required-error';
import { ReferralListRefresh } from './referral-list-refresh';
import { ReferralPaneEmpty } from './referral-pane-empty/referral-pane-empty';
import { ReferralPortalDisabledError } from './referral-portal-disabled-error';
import type { ReferralFilter } from './referral.types';
import { Referrals } from './referrals';

@Component({
  template: '<router-outlet />',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestApp {}

const ROUTES: Routes = [
  {
    path: 'referrals/:filter',
    component: Referrals,
    children: [{ path: '', component: ReferralPaneEmpty }],
  },
];

function makeReferral(overrides: Partial<ReferralListItem> = {}): ReferralListItem {
  return {
    id: 'req-1',
    submitted: new Date().toISOString(),
    estimatedDueDate: { month: '3', day: '15', year: '2027' },
    services: ['birth-doula'],
    area: 'Rochester, NY',
    responseCount: 0,
    isOpen: true,
    hiredBadge: false,
    ...overrides,
  };
}

async function setup({
  loading = false,
  failure,
  referrals = [] as ReferralListItem[],
  showsAllReferrals = false,
  filter = 'open',
}: {
  loading?: boolean;
  failure?: Error;
  referrals?: ReferralListItem[];
  /** True for a Referral Coordinator. */
  showsAllReferrals?: boolean;
  filter?: ReferralFilter;
} = {}) {
  let listReferrals: ReturnType<typeof vi.fn>;
  if (loading) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    listReferrals = vi.fn().mockReturnValue(new Promise(() => {})); // never resolves
  } else if (failure) {
    listReferrals = vi.fn().mockRejectedValue(failure);
  } else {
    listReferrals = vi.fn().mockResolvedValue({ referrals, showsAllReferrals });
  }

  await render(TestApp, {
    providers: [
      { provide: ReferralsService, useValue: { listReferrals } },
      provideRouter(ROUTES, withComponentInputBinding()),
    ],
  });
  await TestBed.inject(Router).navigateByUrl(`/referrals/${filter}`);

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
    expect(await screen.findByRole('link', { name: 'Open (2)' })).toHaveAttribute(
      'aria-current',
      'page',
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
      '/referrals/open/req-abc',
    );
  });

  it('shows the filter the URL names, keeping it in row links', async () => {
    await setup({
      filter: 'needs-outcome',
      referrals: [
        makeReferral({ id: 'req-open' }),
        makeReferral({
          id: 'req-todo',
          area: 'Albany, NY',
          outreach: { sentAt: new Date().toISOString() },
        }),
      ],
    });
    expect(await screen.findByRole('link', { name: 'Needs outcome (1)' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: 'Open (2)' })).not.toHaveAttribute('aria-current');
    expect(screen.getByRole('link', { name: /Albany, NY/ })).toHaveAttribute(
      'href',
      '/referrals/needs-outcome/req-todo',
    );
    expect(screen.queryByRole('link', { name: /Rochester, NY/ })).toBeNull();
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
    expect(await screen.findByRole('link', { name: 'Open (1)' })).toBeVisible();
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
    await user.click(await screen.findByRole('link', { name: 'My Outreach (2)' }));

    expect(screen.getByRole('link', { name: 'My Outreach (2)' })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /Albany, NY/ })).toHaveTextContent('You reached out');
    expect(screen.getByRole('link', { name: /Buffalo, NY/ })).toHaveTextContent('You reached out');
    expect(screen.queryByRole('link', { name: /Rochester, NY/ })).toBeNull();
  });

  it('says when you have not sent Outreach yet', async () => {
    await setup({ referrals: [makeReferral()] });
    const user = userEvent.setup();
    await user.click(await screen.findByRole('link', { name: 'My Outreach (0)' }));
    expect(screen.getByText("You haven't sent Outreach yet.")).toBeVisible();
  });

  it('reloads the list when the pane reports sent Outreach', async () => {
    const { listReferrals, listRefresh } = await setup({ referrals: [makeReferral()] });
    await screen.findByRole('link', { name: /Rochester, NY/ });
    listReferrals.mockResolvedValue({
      referrals: [
        makeReferral({ responseCount: 1, outreach: { sentAt: new Date().toISOString() } }),
      ],
      showsAllReferrals: false,
    });

    listRefresh.request();

    expect(await screen.findByText('You reached out · Record outcome')).toBeVisible();
    expect(screen.getByText('1 member responded')).toBeVisible();
  });

  describe('Referral Outcome', () => {
    const sentAt = new Date().toISOString();

    it('prompts you to record an outcome on a Referral you reached out on', async () => {
      await setup({ referrals: [makeReferral({ outreach: { sentAt } })] });
      expect(await screen.findByRole('link', { name: /Rochester, NY/ })).toHaveTextContent(
        'You reached out · Record outcome',
      );
    });

    it.each([
      ['hired', 'You: Hired'],
      ['not_hired', 'You: Not hired'],
      ['not_a_fit', 'You: Not a fit'],
    ] as const)('shows your %s Outcome on the row', async (outcome, label) => {
      await setup({ referrals: [makeReferral({ outreach: { sentAt }, outcome })] });
      const row = await screen.findByRole('link', { name: /Rochester, NY/ });
      expect(row).toHaveTextContent(label);
      expect(row).not.toHaveTextContent('Record outcome');
    });

    it('shows "A member was hired" on a Referral where any member was hired', async () => {
      await setup({
        referrals: [
          makeReferral({ hiredBadge: true }),
          makeReferral({ id: 'req-2', area: 'Albany, NY' }),
        ],
      });
      expect(await screen.findByRole('link', { name: /Rochester, NY/ })).toHaveTextContent(
        'A member was hired',
      );
      expect(screen.getByRole('link', { name: /Albany, NY/ })).not.toHaveTextContent(
        'A member was hired',
      );
    });

    it('lists only Referrals you reached out on without an Outcome under Needs outcome', async () => {
      await setup({
        referrals: [
          makeReferral({ id: 'req-open', area: 'Rochester, NY' }),
          makeReferral({ id: 'req-todo', area: 'Albany, NY', outreach: { sentAt } }),
          makeReferral({
            id: 'req-old-todo',
            area: 'Buffalo, NY',
            isOpen: false,
            outreach: { sentAt },
          }),
          makeReferral({
            id: 'req-done',
            area: 'Ithaca, NY',
            outreach: { sentAt },
            outcome: 'not_a_fit',
          }),
        ],
      });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('link', { name: 'Needs outcome (2)' }));

      expect(screen.getByRole('link', { name: /Albany, NY/ })).toBeVisible();
      expect(screen.getByRole('link', { name: /Buffalo, NY/ })).toBeVisible();
      expect(screen.queryByRole('link', { name: /Rochester, NY/ })).toBeNull();
      expect(screen.queryByRole('link', { name: /Ithaca, NY/ })).toBeNull();
    });

    it('lists a Referral an Offline Response names you on under My Outreach and Needs outcome, prompting an outcome', async () => {
      await setup({
        referrals: [
          makeReferral({ id: 'req-open', area: 'Rochester, NY' }),
          makeReferral({
            id: 'req-offline',
            area: 'Buffalo, NY',
            isOpen: false,
            offlineResponse: { recordedAt: sentAt },
          }),
        ],
      });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('link', { name: 'My Outreach (1)' }));
      expect(screen.getByRole('link', { name: /Buffalo, NY/ })).toHaveTextContent(
        'You responded outside the portal · Record outcome',
      );
      expect(screen.queryByRole('link', { name: /Rochester, NY/ })).toBeNull();

      await user.click(screen.getByRole('link', { name: 'Needs outcome (1)' }));
      expect(screen.getByRole('link', { name: /Buffalo, NY/ })).toBeVisible();
    });

    it('says when nothing needs an outcome', async () => {
      await setup({ referrals: [makeReferral()] });
      const user = userEvent.setup();
      await user.click(await screen.findByRole('link', { name: 'Needs outcome (0)' }));
      expect(
        screen.getByText('Nothing to record. After you send Outreach, record how it went here.'),
      ).toBeVisible();
    });
  });

  describe('Referral Coordinator', () => {
    const OLD = makeReferral({
      id: 'req-old',
      area: 'Buffalo, NY',
      isOpen: false,
      submitted: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    });

    it('offers All referrals, listing Referrals older than 14 days', async () => {
      await setup({ referrals: [makeReferral(), OLD], showsAllReferrals: true });
      const user = userEvent.setup();
      expect(await screen.findByRole('link', { name: 'Open (1)' })).toBeVisible();
      await user.click(screen.getByRole('link', { name: 'All referrals (2)' }));

      expect(screen.getByRole('link', { name: /Rochester, NY/ })).toBeVisible();
      expect(screen.getByRole('link', { name: /Buffalo, NY/ })).toBeVisible();
    });

    it('keeps Open, My Outreach and Needs outcome for a Coordinator', async () => {
      await setup({ referrals: [makeReferral(), OLD], showsAllReferrals: true });
      expect(await screen.findByRole('link', { name: 'Open (1)' })).toHaveAttribute(
        'aria-current',
        'page',
      );
      expect(screen.getByRole('link', { name: 'My Outreach (0)' })).toBeVisible();
      expect(screen.getByRole('link', { name: 'Needs outcome (0)' })).toBeVisible();
    });

    it('never offers All referrals to an ordinary member', async () => {
      await setup({ referrals: [makeReferral()] });
      await screen.findByRole('link', { name: 'Open (1)' });
      expect(screen.queryByRole('link', { name: /All referrals/ })).toBeNull();
    });
  });

  it('handles a Referral with no area or due date', async () => {
    await setup({
      referrals: [makeReferral({ area: '', estimatedDueDate: { month: '', day: '', year: '' } })],
    });
    const row = await screen.findByRole('link', { name: /Area not provided/ });
    expect(row).toHaveTextContent('Due not provided');
  });
});
