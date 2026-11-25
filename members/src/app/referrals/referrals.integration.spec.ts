import { Location } from '@angular/common';
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
import { ReferralsService } from '../services/referrals.service';
import { isReferralFilter } from './is-referral-filter';
import { ReferralDetail } from './referral-detail/referral-detail';
import { ReferralPaneEmpty } from './referral-pane-empty/referral-pane-empty';
import type { ReferralDetail as ReferralDetailModel, ReferralListItem } from './referral.types';
import { Referrals } from './referrals';

@Component({
  template: '<router-outlet />',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestApp {}

// Mirrors the `referrals` block of app.routes.ts, with eager components.
const ROUTES: Routes = [
  {
    path: 'referrals',
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'open' },
      {
        path: ':filter',
        canMatch: [isReferralFilter],
        component: Referrals,
        children: [
          { path: '', component: ReferralPaneEmpty },
          { path: ':id', component: ReferralDetail },
        ],
      },
      { path: ':id', redirectTo: 'open/:id' },
    ],
  },
];

const ROCHESTER: ReferralListItem = {
  id: 'req-1',
  submitted: new Date().toISOString(),
  estimatedDueDate: { month: '3', day: '15', year: '2027' },
  services: ['birth-doula'],
  area: 'Rochester, NY',
  responseCount: 0,
  isOpen: true,
  hiredBadge: false,
};

const BUFFALO: ReferralListItem = {
  id: 'req-2',
  submitted: new Date().toISOString(),
  estimatedDueDate: { month: '5', day: '2', year: '2027' },
  services: ['postpartum-doula'],
  area: 'Buffalo, NY',
  responseCount: 0,
  isOpen: true,
  hiredBadge: false,
};

const REFERRALS = [ROCHESTER, BUFFALO];

function toDetail(item: ReferralListItem, firstName: string): ReferralDetailModel {
  return {
    id: item.id,
    firstName,
    zipcode: '',
    area: item.area,
    prefersSpanish: false,
    responseCount: item.responseCount,
    estimatedDueDate: item.estimatedDueDate,
    services: item.services,
    birthLocation: '',
    otherInfo: '',
    insurance: [],
    submitted: item.submitted,
    isOpen: item.isOpen,
    outreachSender: { name: 'Dana Doula', email: 'dana@example.com' },
    hiredBadge: item.hiredBadge,
  };
}

const DETAILS: Record<string, ReferralDetailModel> = {
  'req-1': toDetail(ROCHESTER, 'Maya'),
  'req-2': toDetail(BUFFALO, 'Ana'),
};

async function setup({ url = '/referrals' }: { url?: string } = {}) {
  const listReferrals = vi
    .fn()
    .mockResolvedValue({ referrals: REFERRALS, showsAllReferrals: false });
  const getReferral = vi.fn((id: string) => Promise.resolve(DETAILS[id]));
  const sendOutreach = vi.fn();

  await render(TestApp, {
    providers: [
      { provide: ReferralsService, useValue: { listReferrals, getReferral, sendOutreach } },
      provideRouter(ROUTES, withComponentInputBinding()),
    ],
  });

  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  // Listen to history like the bootstrapped app does, so Location.back() navigates.
  router.initialNavigation();
  const user = userEvent.setup();
  const location = TestBed.inject(Location);

  return { user, router, location, listReferrals, getReferral, sendOutreach };
}

/** From here on, detail requests never answer: only cached details can show. */
function stallDetailRequests(getReferral: ReturnType<typeof vi.fn>) {
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  getReferral.mockReturnValue(new Promise(() => {}));
}

describe('Referral inbox routing', () => {
  it('redirects /referrals to the Open filter with an empty pane', async () => {
    const { router } = await setup();
    expect(router.url).toBe('/referrals/open');
    expect(await screen.findByRole('link', { name: /Rochester, NY/ })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Open (2)' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByText('Select a referral to see its details.')).toBeInTheDocument();
  });

  it('shows the filter named by /referrals/:filter', async () => {
    await setup({ url: '/referrals/my-outreach' });
    expect(await screen.findByText("You haven't sent Outreach yet.")).toBeVisible();
    expect(screen.getByRole('link', { name: 'My Outreach (0)' })).toHaveAttribute(
      'aria-current',
      'page',
    );
  });

  it('lands a legacy /referrals/:id link on the Open filter with that Referral selected', async () => {
    const { router } = await setup({ url: '/referrals/req-2' });
    expect(router.url).toBe('/referrals/open/req-2');
    expect(await screen.findByRole('heading', { name: 'Ana · Buffalo, NY' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Buffalo, NY/ })).toHaveAttribute(
      'href',
      '/referrals/open/req-2',
    );
  });

  it('switches filter without fetching the list again, and back returns to the previous filter', async () => {
    const { user, router, location, listReferrals } = await setup({ url: '/referrals/open' });
    await screen.findByRole('link', { name: /Rochester, NY/ });

    await user.click(screen.getByRole('link', { name: 'My Outreach (0)' }));

    expect(await screen.findByText("You haven't sent Outreach yet.")).toBeVisible();
    expect(router.url).toBe('/referrals/my-outreach');
    expect(listReferrals).toHaveBeenCalledOnce();

    location.back();

    expect(await screen.findByRole('link', { name: /Rochester, NY/ })).toBeVisible();
    expect(router.url).toBe('/referrals/open');
    expect(screen.getByRole('link', { name: 'Open (2)' })).toHaveAttribute('aria-current', 'page');
    expect(listReferrals).toHaveBeenCalledOnce();
  });

  it('selects the Referral named by /referrals/:filter/:id', async () => {
    await setup({ url: '/referrals/open/req-2' });
    expect(await screen.findByRole('heading', { name: 'Ana · Buffalo, NY' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Buffalo, NY/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /Rochester, NY/ })).not.toHaveAttribute('aria-current');
  });

  it('switches the pane when another row is chosen, keeping the list loaded', async () => {
    const { user, listReferrals } = await setup({ url: '/referrals/open/req-1' });
    await screen.findByRole('heading', { name: 'Maya · Rochester, NY' });

    await user.click(screen.getByRole('link', { name: /Buffalo, NY/ }));

    expect(await screen.findByRole('heading', { name: 'Ana · Buffalo, NY' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Maya · Rochester, NY' })).toBeNull();
    expect(listReferrals).toHaveBeenCalledOnce();
  });

  it('marks the row as reached out after sending Outreach from the pane', async () => {
    const { user, listReferrals, sendOutreach } = await setup({ url: '/referrals/open/req-1' });
    await screen.findByRole('heading', { name: 'Maya · Rochester, NY' });
    const sentAt = new Date().toISOString();
    sendOutreach.mockResolvedValue({
      outreach: { sentAt },
      contact: { fullName: 'Maya Lopez', email: 'maya@example.com', phone: '555-0100' },
    });
    listReferrals.mockResolvedValue({
      referrals: [{ ...ROCHESTER, responseCount: 1, outreach: { sentAt } }, BUFFALO],
      showsAllReferrals: false,
    });

    await user.click(screen.getByRole('button', { name: 'Send Outreach' }));

    expect(await screen.findByRole('heading', { name: 'Maya Lopez' })).toBeVisible();
    const row = screen.getByRole('link', { name: /Rochester, NY/ });
    await vi.waitFor(() => {
      expect(row).toHaveTextContent('You reached out');
    });
    expect(listReferrals).toHaveBeenCalledTimes(2);
  });

  describe('switching between Referrals', () => {
    it('shows open Referrals at once, never a loading message', async () => {
      const { user, getReferral } = await setup({ url: '/referrals/open/req-1' });
      await screen.findByRole('heading', { name: 'Maya · Rochester, NY' });
      await vi.waitFor(() => {
        expect(getReferral).toHaveBeenCalledWith('req-2');
      });
      stallDetailRequests(getReferral);

      await user.click(screen.getByRole('link', { name: /Buffalo, NY/ }));
      expect(await screen.findByRole('heading', { name: 'Ana · Buffalo, NY' })).toBeVisible();
      expect(screen.queryByText('Loading referral...')).toBeNull();

      await user.click(screen.getByRole('link', { name: /Rochester, NY/ }));
      expect(await screen.findByRole('heading', { name: 'Maya · Rochester, NY' })).toBeVisible();
      expect(screen.queryByText('Loading referral...')).toBeNull();
    });

    it('moves focus to the chosen Referral and starts its composer fresh', async () => {
      const { user } = await setup({ url: '/referrals/open/req-1' });
      await screen.findByRole('heading', { name: 'Maya · Rochester, NY' });
      const message = screen.getByRole('textbox', { name: /message/i });
      await user.clear(message);
      await user.type(message, 'A draft for Maya');

      await user.click(screen.getByRole('link', { name: /Buffalo, NY/ }));

      const heading = await screen.findByRole('heading', { name: 'Ana · Buffalo, NY' });
      await vi.waitFor(() => {
        expect(heading).toHaveFocus();
      });
      expect(screen.getByRole('textbox', { name: /message/i })).not.toHaveValue('A draft for Maya');
    });

    it('keeps sent Outreach when returning to a Referral', async () => {
      const { user, getReferral, sendOutreach } = await setup({ url: '/referrals/open/req-1' });
      await screen.findByRole('heading', { name: 'Maya · Rochester, NY' });
      sendOutreach.mockResolvedValue({
        outreach: { sentAt: new Date().toISOString() },
        contact: { fullName: 'Maya Lopez', email: 'maya@example.com', phone: '555-0100' },
      });
      await user.click(screen.getByRole('button', { name: 'Send Outreach' }));
      await screen.findByRole('heading', { name: 'Maya Lopez' });
      stallDetailRequests(getReferral);

      await user.click(screen.getByRole('link', { name: /Buffalo, NY/ }));
      await screen.findByRole('heading', { name: 'Ana · Buffalo, NY' });
      await user.click(screen.getByRole('link', { name: /Rochester, NY/ }));

      expect(await screen.findByRole('heading', { name: 'Maya Lopez' })).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Send Outreach' })).toBeNull();
    });
  });
});
