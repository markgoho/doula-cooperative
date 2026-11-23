import { inputBinding } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ReferralsService,
  type ReferralDetail as ReferralDetailModel,
} from '../../services/referrals.service';
import { MembershipRequiredError } from '../membership-required-error';
import { ReferralListRefresh } from '../referral-list-refresh';
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
  sendFailure,
}: {
  loading?: boolean;
  failure?: Error;
  id?: string;
  referral?: ReferralDetailModel;
  sendFailure?: Error;
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

  // A failed send fails once, so a retry succeeds.
  const sendOutreach = vi.fn().mockResolvedValue(SENT);
  if (sendFailure) sendOutreach.mockRejectedValueOnce(sendFailure);

  await render(ReferralDetail, {
    bindings: [inputBinding('id', () => id)],
    providers: [
      { provide: ReferralsService, useValue: { getReferral, sendOutreach } },
      provideRouter([]),
    ],
  });
  const user = userEvent.setup();

  return { getReferral, sendOutreach, user, listRefresh: TestBed.inject(ReferralListRefresh) };
}

const SENDER = {
  name: 'Dana Doula',
  email: 'dana@example.com',
  profileUrl: 'https://doulacooperative.com/doulas/dana-doula/',
};

const SENT = {
  outreach: { sentAt: '2026-11-20T15:30:00.000Z' },
  contact: { fullName: 'Maya Lopez', email: 'maya@example.com', phone: '555-0100' },
};

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

  it('says contact details appear after Outreach, without a composer when you cannot send', async () => {
    await setup();
    expect(await screen.findByRole('heading', { name: 'Contact details' })).toBeVisible();
    expect(
      screen.getByText("Maya's full name, email, and phone appear after you send Outreach."),
    ).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByRole('button')).toBeNull();
  });

  describe('Outreach composer', () => {
    const withSender = () => makeReferralDetail({ outreachSender: SENDER });

    it('starts with an editable template greeting the requester, signed with your name and Doula Profile link', async () => {
      await setup({ referral: withSender() });
      const message = await screen.findByRole('textbox', { name: 'Message to Maya' });
      const text = (message as HTMLTextAreaElement).value;
      expect(text).toMatch(/^Hi Maya,/);
      expect(text).toContain("I'm Dana Doula, a doula with the Rochester Doula Cooperative.");
      expect(text).toContain('birth, postpartum support around Apr 12, 2027');
      expect(text).toContain(
        'You can read more about me here: https://doulacooperative.com/doulas/dana-doula/',
      );
      expect(text).toMatch(/Warmly,\nDana Doula$/);
    });

    it('leaves out the Doula Profile line when you have no published profile', async () => {
      await setup({
        referral: makeReferralDetail({
          outreachSender: { name: 'Dana Doula', email: 'dana@example.com' },
        }),
      });
      const message = await screen.findByRole('textbox', { name: 'Message to Maya' });
      expect((message as HTMLTextAreaElement).value).not.toContain('read more about me');
    });

    it('explains who it comes from, where replies go, and the once-per-referral limit', async () => {
      await setup({ referral: withSender() });
      await screen.findByRole('textbox', { name: 'Message to Maya' });
      expect(screen.getByText(/Sent from/)).toHaveTextContent(
        'Sent from Dana Doula via Doula Cooperative. Replies go to dana@example.com, and you get a copy by BCC. You can send Outreach once per referral',
      );
    });

    it('sends your edited message', async () => {
      const { user, sendOutreach } = await setup({ referral: withSender() });
      const message = await screen.findByRole('textbox', { name: 'Message to Maya' });
      await user.clear(message);
      await user.type(message, 'Hello Maya, I would love to help.');
      await user.click(screen.getByRole('button', { name: 'Send Outreach' }));
      expect(sendOutreach).toHaveBeenCalledWith('req-1', 'Hello Maya, I would love to help.');
    });

    it('rejects an empty message without sending', async () => {
      const { user, sendOutreach } = await setup({ referral: withSender() });
      const message = await screen.findByRole('textbox', { name: 'Message to Maya' });
      await user.clear(message);
      await user.type(message, ' '.repeat(3));
      await user.click(screen.getByRole('button', { name: 'Send Outreach' }));

      expect(screen.getByText('Write a message before sending Outreach.')).toBeVisible();
      expect(message).toHaveAttribute('aria-invalid', 'true');
      expect(message).toHaveFocus();
      expect(sendOutreach).not.toHaveBeenCalled();
    });

    it('reveals full name, email and phone with the sent time after sending', async () => {
      const { user, listRefresh } = await setup({ referral: withSender() });
      await user.click(await screen.findByRole('button', { name: 'Send Outreach' }));

      const name = await screen.findByRole('heading', { name: 'Maya Lopez' });
      expect(name).toHaveFocus();
      expect(screen.getByRole('link', { name: 'maya@example.com' })).toHaveAttribute(
        'href',
        'mailto:maya@example.com',
      );
      expect(screen.getByRole('link', { name: '555-0100' })).toHaveAttribute(
        'href',
        'tel:555-0100',
      );
      expect(screen.getByRole('status')).toHaveTextContent(/^You reached out Nov 20, /);
      expect(screen.getByText('1 member responded')).toBeVisible();
      expect(screen.queryByRole('textbox')).toBeNull();
      expect(screen.queryByRole('button', { name: 'Send Outreach' })).toBeNull();
      expect(listRefresh.version()).toBe(1);
    });

    it('shows a failed send with your message kept, and lets you retry', async () => {
      const { user, sendOutreach } = await setup({
        referral: withSender(),
        sendFailure: new Error(
          "Your message wasn't sent, and nothing was shared. Please try again.",
        ),
      });
      const message = await screen.findByRole('textbox', { name: 'Message to Maya' });
      await user.type(message, ' P.S. Thanks!');
      await user.click(screen.getByRole('button', { name: 'Send Outreach' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Your message wasn't sent, and nothing was shared. Please try again.",
      );
      expect((message as HTMLTextAreaElement).value).toMatch(/P\.S\. Thanks!$/);
      expect(screen.queryByRole('heading', { name: 'Maya Lopez' })).toBeNull();
      expect(
        screen.getByText("Maya's full name, email, and phone appear after you send Outreach."),
      ).toBeVisible();

      await user.click(screen.getByRole('button', { name: 'Send Outreach' }));
      expect(await screen.findByRole('heading', { name: 'Maya Lopez' })).toBeVisible();
      expect(sendOutreach).toHaveBeenCalledTimes(2);
    });
  });

  it('shows revealed contact details for a Referral you already reached out on, without a composer', async () => {
    await setup({ referral: makeReferralDetail({ ...SENT, responseCount: 2 }) });
    expect(await screen.findByRole('heading', { name: 'Maya Lopez' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'maya@example.com' })).toBeVisible();
    expect(screen.queryByRole('textbox')).toBeNull();
    expect(screen.queryByText(/appear after you send Outreach/)).toBeNull();
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
