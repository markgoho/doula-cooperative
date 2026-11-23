import { inputBinding } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import { describe, expect, it, vi } from 'vitest';
import {
  ReferralsService,
  type ReferralDetail as ReferralDetailModel,
} from '../../services/referrals.service';
import { MembershipRequiredError } from '../membership-required-error';
import { ReferralNotOpenError } from '../referral-not-open-error';
import { ReferralPortalDisabledError } from '../referral-portal-disabled-error';
import { ReferralDetail } from './referral-detail';

const DAY_MS = 24 * 60 * 60 * 1000;

function makeReferralDetail(overrides: Partial<ReferralDetailModel> = {}): ReferralDetailModel {
  return {
    id: 'req-1',
    firstName: 'Maya',
    zipcode: '11215',
    area: 'Brooklyn, NY',
    prefersSpanish: false,
    responseCount: 0,
    estimatedDueDate: { month: '4', day: '12', year: '2027' },
    services: ['birth-doula', 'postpartum-doula'],
    birthLocation: 'NYU Langone Brooklyn',
    otherInfo: 'First baby.',
    insurance: ['Medicaid'],
    submitted: new Date(Date.now() - 4 * DAY_MS).toISOString(),
    ...overrides,
  };
}

async function setup({
  loading = false,
  failure,
  id = 'req-1',
  referral = makeReferralDetail(),
}: {
  loading?: boolean;
  failure?: Error;
  id?: string;
  referral?: ReferralDetailModel;
} = {}) {
  let getReferral: ReturnType<typeof vi.fn>;
  if (loading) {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    getReferral = vi.fn().mockReturnValue(new Promise(() => {}));
  } else if (failure) {
    getReferral = vi.fn().mockRejectedValue(failure);
  } else {
    getReferral = vi.fn().mockResolvedValue(referral);
  }

  await render(ReferralDetail, {
    bindings: [inputBinding('id', () => id)],
    providers: [{ provide: ReferralsService, useValue: { getReferral } }, provideRouter([])],
  });

  return { getReferral };
}

describe('ReferralDetail pane', () => {
  it('shows a loading message while fetching', async () => {
    await setup({ loading: true });
    expect(await screen.findByRole('status')).toHaveTextContent('Loading referral...');
  });

  it('loads the Referral named by the route', async () => {
    const { getReferral } = await setup({ id: 'req-abc' });
    await screen.findByRole('heading', { level: 2 });
    expect(getReferral).toHaveBeenCalledWith('req-abc');
  });

  it('titles the pane with the first name and area', async () => {
    await setup();
    expect(await screen.findByRole('heading', { name: 'Maya · Brooklyn, NY' })).toBeVisible();
  });

  it('shows the pre-Outreach request facts', async () => {
    await setup();
    await screen.findByRole('heading', { name: 'Maya · Brooklyn, NY' });
    expect(screen.getByText('Apr 12, 2027')).toBeVisible();
    expect(screen.getByText('Birth, Postpartum')).toBeVisible();
    expect(screen.getByText('Brooklyn, NY (11215)')).toBeVisible();
    expect(screen.getByText('NYU Langone Brooklyn')).toBeVisible();
    expect(screen.getByText('Medicaid')).toBeVisible();
    expect(screen.getByText('First baby.')).toBeVisible();
  });

  it('shows when the Referral was submitted and how long it stays open', async () => {
    await setup();
    expect(await screen.findByText('4 days ago · Open 10 more days')).toBeVisible();
  });

  it('shows how many members responded', async () => {
    await setup();
    expect(await screen.findByText('No one has responded yet')).toBeVisible();
  });

  it('says contact details appear after Outreach, without a composer', async () => {
    await setup();
    expect(await screen.findByRole('heading', { name: 'Contact details' })).toBeVisible();
    expect(
      screen.getByText("Maya's full name, email, and phone appear after you send Outreach."),
    ).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('flags a requester who prefers Spanish', async () => {
    await setup({ referral: makeReferralDetail({ prefersSpanish: true }) });
    expect(await screen.findByText('Requester prefers Spanish')).toBeVisible();
  });

  it('fills in missing facts with "Not provided"', async () => {
    await setup({
      referral: makeReferralDetail({
        estimatedDueDate: { month: '', day: '', year: '' },
        birthLocation: '',
        insurance: [],
        otherInfo: '',
      }),
    });
    await screen.findByRole('heading', { name: 'Maya · Brooklyn, NY' });
    expect(screen.getAllByText('Not provided')).toHaveLength(3);
    expect(screen.queryByText('Notes')).toBeNull();
  });

  it('moves focus to the selected Referral', async () => {
    await setup();
    const heading = await screen.findByRole('heading', { name: 'Maya · Brooklyn, NY' });
    expect(heading).toHaveFocus();
  });

  it('says a Referral past its window is no longer open, with a link to the list', async () => {
    await setup({ failure: new ReferralNotOpenError() });
    expect(
      await screen.findByRole('heading', { name: 'This referral is no longer open' }),
    ).toBeVisible();
    expect(screen.getByRole('link', { name: 'See open referrals' })).toHaveAttribute(
      'href',
      '/referrals',
    );
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('shows other errors as an alert', async () => {
    await setup({ failure: new Error('Referral not found.') });
    expect(await screen.findByRole('alert')).toHaveTextContent('Referral not found.');
  });

  it.each([
    ['lapsed membership', new MembershipRequiredError()],
    ['portal not available yet', new ReferralPortalDisabledError()],
  ])('leaves the %s state to the inbox page', async (_name, failure) => {
    await setup({ failure });
    await waitFor(() => {
      expect(screen.queryByRole('status')).toBeNull();
    });
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
