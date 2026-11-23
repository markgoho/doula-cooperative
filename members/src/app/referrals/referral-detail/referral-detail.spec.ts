import { inputBinding } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { render, screen, waitFor, within } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import {
  ReferralsService,
  type ReferralDetail as ReferralDetailModel,
  type ReferralOutcome,
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
    hiredBadge: false,
    ...overrides,
  };
}

async function setup({
  loading = false,
  failure,
  id = 'req-1',
  referral = makeReferralDetail(),
  sendFailure,
  outcomeFailure,
  hiredBadgeAfterSave = false,
}: {
  loading?: boolean;
  failure?: Error;
  id?: string;
  referral?: ReferralDetailModel;
  sendFailure?: Error;
  /** The next Outcome save fails once with this error. */
  outcomeFailure?: Error;
  /** The hired badge the API reports after an Outcome save. */
  hiredBadgeAfterSave?: boolean;
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

  const setOutcome = vi.fn((_id: string, outcome: ReferralOutcome) =>
    Promise.resolve({
      outcome,
      outcomeUpdatedAt: '2026-11-22T10:00:00.000Z',
      hiredBadge: hiredBadgeAfterSave || outcome === 'hired',
    }),
  );
  const clearOutcome = vi.fn(() => Promise.resolve({ hiredBadge: hiredBadgeAfterSave }));
  if (outcomeFailure) {
    setOutcome.mockRejectedValueOnce(outcomeFailure);
    clearOutcome.mockRejectedValueOnce(outcomeFailure);
  }

  await render(ReferralDetail, {
    bindings: [inputBinding('id', () => id)],
    providers: [
      {
        provide: ReferralsService,
        useValue: { getReferral, sendOutreach, setOutcome, clearOutcome },
      },
      provideRouter([]),
    ],
  });
  const user = userEvent.setup();

  return {
    getReferral,
    sendOutreach,
    setOutcome,
    clearOutcome,
    user,
    listRefresh: TestBed.inject(ReferralListRefresh),
  };
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

/** The Coordinator-only Responses panel. */
function panel() {
  return screen.getByRole('region', { name: 'Responses' });
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
      expect(screen.getByText(/^You reached out Nov 20, /)).toBeVisible();
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

  describe('Referral Outcome', () => {
    const reachedOut = (overrides: Partial<ReferralDetailModel> = {}) =>
      makeReferralDetail({ ...SENT, responseCount: 1, ...overrides });

    it('offers no Outcome control before your Outreach', async () => {
      await setup({ referral: makeReferralDetail({ outreachSender: SENDER }) });
      await screen.findByRole('button', { name: 'Send Outreach' });
      expect(screen.queryByRole('group', { name: 'Record outcome' })).toBeNull();
      expect(screen.queryByRole('button', { name: 'Hired' })).toBeNull();
    });

    it('prompts you to record an outcome after your Outreach', async () => {
      await setup({ referral: reachedOut() });
      const group = await screen.findByRole('group', { name: 'Record outcome' });
      expect(group).toBeVisible();
      for (const name of ['Hired', 'Not hired', 'Not a fit']) {
        expect(screen.getByRole('button', { name })).toHaveAttribute('aria-pressed', 'false');
      }
      expect(screen.queryByRole('button', { name: 'Clear outcome' })).toBeNull();
    });

    it('saves an Outcome as soon as you choose it, and refreshes the list', async () => {
      const { user, setOutcome, listRefresh } = await setup({ referral: reachedOut() });
      await user.click(await screen.findByRole('button', { name: 'Not hired' }));

      expect(setOutcome).toHaveBeenCalledWith('req-1', 'not_hired');
      expect(await screen.findByText('Saved')).toBeVisible();
      expect(screen.getByRole('group', { name: 'Your outcome' })).toBeVisible();
      expect(screen.getByRole('button', { name: 'Not hired' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Not hired' })).toHaveFocus();
      expect(listRefresh.version()).toBe(1);
    });

    it('shows "A member was hired" after you record hired', async () => {
      const { user } = await setup({ referral: reachedOut() });
      await user.click(await screen.findByRole('button', { name: 'Hired' }));
      expect(await screen.findByText('A member was hired')).toBeVisible();
    });

    it('changes a saved Outcome', async () => {
      const { user, setOutcome } = await setup({
        referral: reachedOut({ outcome: 'not_a_fit' }),
      });
      expect(await screen.findByRole('button', { name: 'Not a fit' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      await user.click(screen.getByRole('button', { name: 'Hired' }));

      expect(setOutcome).toHaveBeenCalledWith('req-1', 'hired');
      await screen.findByText('Saved');
      expect(screen.getByRole('button', { name: 'Hired' })).toHaveAttribute('aria-pressed', 'true');
      expect(screen.getByRole('button', { name: 'Not a fit' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
    });

    it('does not save again when you choose the Outcome already saved', async () => {
      const { user, setOutcome } = await setup({
        referral: reachedOut({ outcome: 'hired', hiredBadge: true }),
      });
      await user.click(await screen.findByRole('button', { name: 'Hired' }));
      expect(setOutcome).not.toHaveBeenCalled();
    });

    it('clears a saved Outcome, keeping focus in the control', async () => {
      const { user, clearOutcome } = await setup({
        referral: reachedOut({ outcome: 'hired', hiredBadge: true }),
      });
      expect(await screen.findByText('A member was hired')).toBeVisible();
      await user.click(screen.getByRole('button', { name: 'Clear outcome' }));

      expect(clearOutcome).toHaveBeenCalledWith('req-1');
      expect(await screen.findByText('Outcome cleared')).toBeVisible();
      expect(screen.getByRole('group', { name: 'Record outcome' })).toBeVisible();
      expect(screen.queryByRole('button', { name: 'Clear outcome' })).toBeNull();
      expect(screen.getByRole('button', { name: 'Hired' })).toHaveFocus();
      expect(screen.queryByText('A member was hired')).toBeNull();
    });

    it('keeps "A member was hired" after clearing when another member was hired', async () => {
      const { user } = await setup({
        referral: reachedOut({ outcome: 'hired', hiredBadge: true }),
        hiredBadgeAfterSave: true,
      });
      await user.click(await screen.findByRole('button', { name: 'Clear outcome' }));
      await screen.findByText('Outcome cleared');
      expect(screen.getByText('A member was hired')).toBeVisible();
    });

    it('puts back your saved Outcome and explains when a save fails', async () => {
      const { user } = await setup({
        referral: reachedOut({ outcome: 'not_hired' }),
        outcomeFailure: new Error("Your outcome wasn't saved. Please try again."),
      });
      await user.click(await screen.findByRole('button', { name: 'Hired' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        "Your outcome wasn't saved. Please try again.",
      );
      expect(screen.getByRole('button', { name: 'Not hired' })).toHaveAttribute(
        'aria-pressed',
        'true',
      );
      expect(screen.getByRole('button', { name: 'Hired' })).toHaveAttribute(
        'aria-pressed',
        'false',
      );
      expect(screen.queryByText('A member was hired')).toBeNull();

      await user.click(screen.getByRole('button', { name: 'Hired' }));
      expect(await screen.findByText('Saved')).toBeVisible();
      expect(screen.queryByRole('alert')).toBeNull();
    });
  });

  describe('Responses panel', () => {
    const BEA = {
      memberUid: 'member-b',
      memberName: 'Bea Doula',
      outreachSentAt: '2026-11-19T15:00:00.000Z',
    };
    const CASS = {
      memberUid: 'member-c',
      memberName: 'Cass Doula',
      outreachSentAt: '2026-11-20T15:30:00.000Z',
      outcome: 'hired' as const,
      outcomeUpdatedAt: '2026-11-21T09:00:00.000Z',
    };

    it('lists each member who sent Outreach with the time and their Outcome', async () => {
      await setup({
        referral: makeReferralDetail({
          responseCount: 2,
          coordinator: {
            responses: [BEA, CASS, { ...BEA, memberUid: 'member-d', outcome: 'not_a_fit' }],
          },
        }),
      });
      await screen.findByRole('heading', { name: 'Responses' });
      const items = within(panel()).getAllByRole('listitem');
      expect(items).toHaveLength(3);
      expect(items[0]).toHaveTextContent('Bea Doula');
      expect(items[0]).toHaveTextContent('Reached out Nov 19');
      expect(items[0]).toHaveTextContent('No outcome yet');
      expect(items[1]).toHaveTextContent('Cass Doula');
      expect(items[1]).toHaveTextContent('Hired');
      expect(items[2]).toHaveTextContent('Not a fit');
    });

    it('says when no one has responded yet', async () => {
      await setup({ referral: makeReferralDetail({ coordinator: { responses: [] } }) });
      await screen.findByRole('heading', { name: 'Responses' });
      expect(within(panel()).getByText('No one has responded yet')).toBeVisible();
      expect(within(panel()).queryByRole('list')).toBeNull();
    });

    it('names a member without a name as such', async () => {
      await setup({
        referral: makeReferralDetail({
          coordinator: { responses: [{ ...BEA, memberName: '' }] },
        }),
      });
      await screen.findByRole('heading', { name: 'Responses' });
      expect(within(panel()).getByRole('listitem')).toHaveTextContent('Name not set');
    });

    it('shows alongside the composer and keeps contact details hidden before your Outreach', async () => {
      await setup({
        referral: makeReferralDetail({
          outreachSender: SENDER,
          responseCount: 1,
          coordinator: { responses: [CASS] },
        }),
      });
      expect(await screen.findByRole('button', { name: 'Send Outreach' })).toBeVisible();
      expect(within(panel()).getByText('Cass Doula')).toBeVisible();
      expect(screen.queryByText('maya@example.com')).toBeNull();
    });

    it('is not shown to an ordinary member', async () => {
      await setup({ referral: makeReferralDetail({ responseCount: 2 }) });
      await screen.findByRole('heading', { name: /Maya/ });
      expect(screen.queryByRole('heading', { name: 'Responses' })).toBeNull();
      expect(screen.queryByRole('region', { name: 'Responses' })).toBeNull();
    });

    it('adds your own Outreach to the panel after you send it, without reloading the pane', async () => {
      const { user, getReferral } = await setup({
        referral: makeReferralDetail({
          outreachSender: SENDER,
          coordinator: { responses: [] },
        }),
      });
      await user.type(await screen.findByRole('textbox', { name: 'Message to Maya' }), '!');
      getReferral.mockResolvedValue(
        makeReferralDetail({
          ...SENT,
          responseCount: 1,
          coordinator: {
            responses: [
              {
                memberUid: 'me',
                memberName: 'Dana Doula',
                outreachSentAt: SENT.outreach.sentAt,
              },
            ],
          },
        }),
      );
      await user.click(screen.getByRole('button', { name: 'Send Outreach' }));

      expect(await screen.findByRole('heading', { name: 'Maya Lopez' })).toHaveFocus();
      await waitFor(() => {
        expect(within(panel()).getByText('Dana Doula')).toBeVisible();
      });
      expect(screen.getByRole('heading', { name: 'Maya Lopez' })).toHaveFocus();
    });

    it('updates your Outcome in the panel after you save it, keeping focus on the control', async () => {
      const mine = {
        memberUid: 'me',
        memberName: 'Dana Doula',
        outreachSentAt: SENT.outreach.sentAt,
      };
      const { user, getReferral } = await setup({
        referral: makeReferralDetail({
          ...SENT,
          responseCount: 1,
          coordinator: { responses: [mine] },
        }),
      });
      getReferral.mockResolvedValue(
        makeReferralDetail({
          ...SENT,
          responseCount: 1,
          coordinator: { responses: [{ ...mine, outcome: 'not_hired' }] },
        }),
      );
      await user.click(await screen.findByRole('button', { name: 'Not hired' }));

      await waitFor(() => {
        expect(within(panel()).getByRole('listitem')).toHaveTextContent('Not hired');
      });
      expect(screen.getByRole('button', { name: 'Not hired' })).toHaveFocus();
    });
  });

  describe('Hired badge', () => {
    it('tells you a member was hired before your Outreach, and that you can still reach out', async () => {
      await setup({ referral: makeReferralDetail({ hiredBadge: true, outreachSender: SENDER }) });
      expect(await screen.findByText('A member was hired')).toBeVisible();
      expect(screen.getByText('You can still reach out.')).toBeVisible();
      expect(screen.getByRole('button', { name: 'Send Outreach' })).toBeEnabled();
    });

    it('shows no badge while no member was hired', async () => {
      await setup();
      await screen.findByRole('heading', { name: 'Maya · Brooklyn, NY' });
      expect(screen.queryByText('A member was hired')).toBeNull();
    });
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
