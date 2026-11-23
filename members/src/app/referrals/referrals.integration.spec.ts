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

const ROUTES: Routes = [
  {
    path: 'referrals',
    component: Referrals,
    children: [
      { path: '', component: ReferralPaneEmpty },
      { path: ':id', component: ReferralDetail },
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
};

const BUFFALO: ReferralListItem = {
  id: 'req-2',
  submitted: new Date().toISOString(),
  estimatedDueDate: { month: '5', day: '2', year: '2027' },
  services: ['postpartum-doula'],
  area: 'Buffalo, NY',
  responseCount: 0,
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
  };
}

const DETAILS: Record<string, ReferralDetailModel> = {
  'req-1': toDetail(ROCHESTER, 'Maya'),
  'req-2': toDetail(BUFFALO, 'Ana'),
};

async function setup({ url = '/referrals' }: { url?: string } = {}) {
  const listReferrals = vi.fn().mockResolvedValue(REFERRALS);
  const getReferral = vi.fn((id: string) => Promise.resolve(DETAILS[id]));

  await render(TestApp, {
    providers: [
      { provide: ReferralsService, useValue: { listReferrals, getReferral } },
      provideRouter(ROUTES, withComponentInputBinding()),
    ],
  });

  const router = TestBed.inject(Router);
  await router.navigateByUrl(url);
  const user = userEvent.setup();

  return { user, listReferrals };
}

describe('Referral inbox routing', () => {
  it('shows the list with an empty pane at /referrals', async () => {
    await setup();
    expect(await screen.findByRole('link', { name: /Rochester, NY/ })).toBeVisible();
    expect(screen.getByText('Select a referral to see its details.')).toBeInTheDocument();
  });

  it('selects the Referral named by /referrals/:id', async () => {
    await setup({ url: '/referrals/req-2' });
    expect(await screen.findByRole('heading', { name: 'Ana · Buffalo, NY' })).toBeVisible();
    expect(screen.getByRole('link', { name: /Buffalo, NY/ })).toHaveAttribute(
      'aria-current',
      'page',
    );
    expect(screen.getByRole('link', { name: /Rochester, NY/ })).not.toHaveAttribute('aria-current');
  });

  it('switches the pane when another row is chosen, keeping the list loaded', async () => {
    const { user, listReferrals } = await setup({ url: '/referrals/req-1' });
    await screen.findByRole('heading', { name: 'Maya · Rochester, NY' });

    await user.click(screen.getByRole('link', { name: /Buffalo, NY/ }));

    expect(await screen.findByRole('heading', { name: 'Ana · Buffalo, NY' })).toBeVisible();
    expect(screen.queryByRole('heading', { name: 'Maya · Rochester, NY' })).toBeNull();
    expect(listReferrals).toHaveBeenCalledOnce();
  });
});
