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
import type { OfflineResponseRow, ReferralDoula } from '../referral.types';
import { MembershipRequiredError } from '../membership-required-error';
import { ReferralDetailCache } from '../referral-detail-cache';
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
    isOpen: true,
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
  doulas = [],
  offlineFailure,
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
  /** The doula picker's list (Referral Coordinators). */
  doulas?: ReferralDoula[];
  /** The next Offline Response add or delete fails once with this error. */
  offlineFailure?: Error;
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
  const setLegacyOutcome = vi.fn((_id: string, _legacyId: string, outcome: ReferralOutcome) =>
    Promise.resolve({
      outcome,
      outcomeUpdatedAt: '2026-11-22T10:00:00.000Z',
      hiredBadge: outcome === 'hired',
    }),
  );
  const clearLegacyOutcome = vi.fn(() => Promise.resolve({ hiredBadge: false }));
  if (outcomeFailure) {
    setOutcome.mockRejectedValueOnce(outcomeFailure);
    clearOutcome.mockRejectedValueOnce(outcomeFailure);
    setLegacyOutcome.mockRejectedValueOnce(outcomeFailure);
    clearLegacyOutcome.mockRejectedValueOnce(outcomeFailure);
  }

  const listReferralDoulas = vi.fn().mockResolvedValue(doulas);
  const recordOfflineResponse = vi.fn().mockResolvedValue({});
  const deleteOfflineResponse = vi.fn().mockResolvedValue(undefined);
  if (offlineFailure) {
    recordOfflineResponse.mockRejectedValueOnce(offlineFailure);
    deleteOfflineResponse.mockRejectedValueOnce(offlineFailure);
  }

  await render(ReferralDetail, {
    bindings: [inputBinding('id', () => id)],
    providers: [
      {
        provide: ReferralsService,
        useValue: {
          getReferral,
          sendOutreach,
          setOutcome,
          clearOutcome,
          setLegacyOutcome,
          clearLegacyOutcome,
          listReferralDoulas,
          recordOfflineResponse,
          deleteOfflineResponse,
        },
      },
      ReferralDetailCache,
      provideRouter([]),
    ],
  });
  const user = userEvent.setup();

  return {
    getReferral,
    sendOutreach,
    setOutcome,
    clearOutcome,
    setLegacyOutcome,
    clearLegacyOutcome,
    listReferralDoulas,
    recordOfflineResponse,
    deleteOfflineResponse,
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

/** The Offline Responses list in the Coordinator panel. */
function offlineList() {
  return within(panel()).getByRole('list', { name: 'Offline Responses' });
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
            offlineResponses: [],
            canRecordOfflineResponses: false,
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
      await setup({
        referral: makeReferralDetail({
          coordinator: { offlineResponses: [], canRecordOfflineResponses: false, responses: [] },
        }),
      });
      await screen.findByRole('heading', { name: 'Responses' });
      expect(within(panel()).getByText('No one has responded yet')).toBeVisible();
      expect(within(panel()).queryByRole('list')).toBeNull();
    });

    it('names a member without a name as such', async () => {
      await setup({
        referral: makeReferralDetail({
          coordinator: {
            offlineResponses: [],
            canRecordOfflineResponses: false,
            responses: [{ ...BEA, memberName: '' }],
          },
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
          coordinator: {
            offlineResponses: [],
            canRecordOfflineResponses: false,
            responses: [CASS],
          },
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
          coordinator: { offlineResponses: [], canRecordOfflineResponses: false, responses: [] },
        }),
      });
      await user.type(await screen.findByRole('textbox', { name: 'Message to Maya' }), '!');
      getReferral.mockResolvedValue(
        makeReferralDetail({
          ...SENT,
          responseCount: 1,
          coordinator: {
            offlineResponses: [],
            canRecordOfflineResponses: false,
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
          coordinator: {
            offlineResponses: [],
            canRecordOfflineResponses: false,
            responses: [mine],
          },
        }),
      });
      getReferral.mockResolvedValue(
        makeReferralDetail({
          ...SENT,
          responseCount: 1,
          coordinator: {
            offlineResponses: [],
            canRecordOfflineResponses: false,
            responses: [{ ...mine, outcome: 'not_hired' }],
          },
        }),
      );
      await user.click(await screen.findByRole('button', { name: 'Not hired' }));

      await waitFor(() => {
        expect(within(panel()).getByRole('listitem')).toHaveTextContent('Not hired');
      });
      expect(screen.getByRole('button', { name: 'Not hired' })).toHaveFocus();
    });
  });

  describe('Offline Responses', () => {
    const RECORDED_AT = '2026-11-20T15:30:00.000Z';
    const BEA_OFFLINE: OfflineResponseRow = {
      kind: 'member',
      id: 'member-b',
      displayName: 'Bea Doula',
      recordedAt: RECORDED_AT,
      recordedByName: 'Dana Coordinator',
      canDelete: true,
    };
    const LEE_OFFLINE: OfflineResponseRow = {
      kind: 'legacy',
      id: 'legacy-lee',
      displayName: 'Lee Legacy',
      recordedAt: RECORDED_AT,
      recordedByName: 'Olive Coordinator',
      canDelete: false,
    };
    const DOULAS: ReferralDoula[] = [
      { kind: 'member', id: 'member-a', displayName: 'Ana Doula' },
      { kind: 'member', id: 'member-b', displayName: 'Bea Doula' },
      { kind: 'member', id: 'member-c', displayName: 'Cass Doula' },
      { kind: 'legacy', id: 'legacy-mia', displayName: 'Mia Legacy' },
    ];
    const coordinatorView = (
      overrides: Partial<NonNullable<ReferralDetailModel['coordinator']>> = {},
    ) => ({
      responses: [
        {
          memberUid: 'member-c',
          memberName: 'Cass Doula',
          outreachSentAt: RECORDED_AT,
        },
      ],
      offlineResponses: [BEA_OFFLINE, LEE_OFFLINE],
      canRecordOfflineResponses: true,
      ...overrides,
    });

    describe('for the member it names', () => {
      it('says the Coordinator recorded your response and lets you record an outcome, without contact details', async () => {
        await setup({
          referral: makeReferralDetail({
            isOpen: false,
            responseCount: 1,
            offlineResponse: { recordedAt: RECORDED_AT },
          }),
        });
        expect(
          await screen.findByText(
            'The Referral Coordinator recorded that you responded outside the portal.',
          ),
        ).toBeVisible();
        expect(screen.getByRole('group', { name: 'Record outcome' })).toBeVisible();
        expect(
          screen.getByText('This referral is past its 14 days, so Outreach is closed.'),
        ).toBeVisible();
        expect(screen.queryByRole('button', { name: 'Send Outreach' })).toBeNull();
        expect(screen.queryByRole('link', { name: /@/ })).toBeNull();
      });

      it('saves an Outcome', async () => {
        const { user, setOutcome } = await setup({
          referral: makeReferralDetail({ offlineResponse: { recordedAt: RECORDED_AT } }),
        });
        await user.click(await screen.findByRole('button', { name: 'Hired' }));
        expect(setOutcome).toHaveBeenCalledWith('req-1', 'hired');
      });

      it('still offers Outreach while the Referral is open, and counts you once after sending', async () => {
        const { user } = await setup({
          referral: makeReferralDetail({
            responseCount: 1,
            outreachSender: SENDER,
            offlineResponse: { recordedAt: RECORDED_AT },
          }),
        });
        await user.type(await screen.findByRole('textbox', { name: 'Message to Maya' }), '!');
        await user.click(screen.getByRole('button', { name: 'Send Outreach' }));

        expect(await screen.findByRole('heading', { name: 'Maya Lopez' })).toBeVisible();
        expect(screen.getByText('1 member responded')).toBeVisible();
      });
    });

    describe('in the Coordinator panel', () => {
      it('lists each Offline Response with who recorded it and when, labelling Legacy Memberships', async () => {
        await setup({ referral: makeReferralDetail({ coordinator: coordinatorView() }) });
        await screen.findByRole('heading', { name: 'Offline Responses' });
        const items = within(offlineList()).getAllByRole('listitem');
        expect(items).toHaveLength(2);
        expect(items[0]).toHaveTextContent('Bea Doula');
        expect(items[0]).toHaveTextContent('by Dana Coordinator');
        expect(items[0]).toHaveTextContent('No outcome yet');
        expect(items[0]).not.toHaveTextContent('Not yet migrated');
        expect(items[1]).toHaveTextContent('Lee Legacy');
        expect(items[1]).toHaveTextContent('Not yet migrated');
        expect(items[1]).toHaveTextContent('by Olive Coordinator');
      });

      describe('Outcome for a doula not yet migrated', () => {
        const leeOutcome = () => screen.findByRole('group', { name: 'Outcome for Lee Legacy' });

        it('lets the Coordinator record it, leaving Members to record their own', async () => {
          const { user, setLegacyOutcome, getReferral } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
          });
          getReferral.mockResolvedValue(
            makeReferralDetail({
              hiredBadge: true,
              coordinator: coordinatorView({
                offlineResponses: [BEA_OFFLINE, { ...LEE_OFFLINE, outcome: 'hired' }],
              }),
            }),
          );
          const group = await leeOutcome();
          expect(screen.queryByText('A member was hired')).toBeNull();
          await user.click(within(group).getByRole('button', { name: 'Hired' }));

          expect(setLegacyOutcome).toHaveBeenCalledWith('req-1', 'legacy-lee', 'hired');
          expect(within(group).getByRole('button', { name: 'Hired' })).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          // The pane picks up the hired badge from the refresh.
          expect(await screen.findByText('A member was hired')).toBeVisible();
          expect(screen.queryByRole('group', { name: 'Outcome for Bea Doula' })).toBeNull();
          const [bea] = within(offlineList()).getAllByRole('listitem');
          expect(within(bea as HTMLElement).queryByRole('button', { name: 'Hired' })).toBeNull();
        });

        it('clears it', async () => {
          const { user, clearLegacyOutcome } = await setup({
            referral: makeReferralDetail({
              coordinator: coordinatorView({
                offlineResponses: [BEA_OFFLINE, { ...LEE_OFFLINE, outcome: 'not_a_fit' }],
              }),
            }),
          });
          const group = await leeOutcome();
          expect(within(group).getByRole('button', { name: 'Not a fit' })).toHaveAttribute(
            'aria-pressed',
            'true',
          );
          await user.click(within(group).getByRole('button', { name: 'Clear outcome' }));
          expect(clearLegacyOutcome).toHaveBeenCalledWith('req-1', 'legacy-lee');
        });

        it('explains a failed save and keeps the last saved Outcome', async () => {
          const { user } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            outcomeFailure: new Error('Only the Referral Coordinator can record an outcome'),
          });
          const group = await leeOutcome();
          await user.click(within(group).getByRole('button', { name: 'Hired' }));
          expect(await within(group).findByRole('alert')).toHaveTextContent(
            'Only the Referral Coordinator can record an outcome',
          );
          expect(within(group).getByRole('button', { name: 'Hired' })).toHaveAttribute(
            'aria-pressed',
            'false',
          );
        });

        it('shows an Admin the Outcome without the control', async () => {
          await setup({
            referral: makeReferralDetail({
              coordinator: coordinatorView({
                canRecordOfflineResponses: false,
                offlineResponses: [{ ...LEE_OFFLINE, outcome: 'hired' }],
              }),
            }),
          });
          await screen.findByRole('heading', { name: 'Offline Responses' });
          expect(screen.queryByRole('group', { name: 'Outcome for Lee Legacy' })).toBeNull();
          expect(within(offlineList()).getByRole('listitem')).toHaveTextContent('Hired');
        });
      });

      it('offers Delete only on the ones you may delete', async () => {
        await setup({ referral: makeReferralDetail({ coordinator: coordinatorView() }) });
        await screen.findByRole('heading', { name: 'Offline Responses' });
        expect(
          within(panel()).getByRole('button', { name: 'Delete Offline Response for Bea Doula' }),
        ).toBeVisible();
        expect(
          within(panel()).queryByRole('button', {
            name: 'Delete Offline Response for Lee Legacy',
          }),
        ).toBeNull();
      });

      it('deletes one, then refreshes the panel, the count and the list', async () => {
        const { user, deleteOfflineResponse, getReferral, listRefresh } = await setup({
          referral: makeReferralDetail({ responseCount: 3, coordinator: coordinatorView() }),
        });
        getReferral.mockResolvedValue(
          makeReferralDetail({
            responseCount: 2,
            coordinator: coordinatorView({ offlineResponses: [LEE_OFFLINE] }),
          }),
        );
        await user.click(
          await screen.findByRole('button', { name: 'Delete Offline Response for Bea Doula' }),
        );

        expect(deleteOfflineResponse).toHaveBeenCalledWith('req-1', BEA_OFFLINE);
        await waitFor(() => {
          expect(within(offlineList()).getAllByRole('listitem')).toHaveLength(1);
        });
        expect(screen.getByText('2 members responded')).toBeVisible();
        expect(
          within(panel()).getByText('Deleted the Offline Response for Bea Doula.'),
        ).toBeVisible();
        expect(screen.getByRole('heading', { name: 'Offline Responses' })).toHaveFocus();
        expect(listRefresh.version()).toBe(1);
      });

      describe('the doula autocomplete', () => {
        const doulaBox = () => screen.findByRole('combobox', { name: 'Find a doula' });
        const optionNames = () =>
          screen
            .getAllByRole('option')
            .map((option) => option.querySelector('.name')?.textContent.trim());

        it('lists nothing until you type', async () => {
          await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: DOULAS,
          });
          const box = await doulaBox();
          expect(box).toHaveAttribute('aria-expanded', 'false');
          expect(screen.queryAllByRole('option')).toHaveLength(0);
          expect(within(panel()).getByText('Type a name to find a doula.')).toBeVisible();
        });

        it('matches any part of the name, labelling only doulas not yet migrated', async () => {
          const { user } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: DOULAS,
          });
          const box = await doulaBox();
          await user.type(box, 'mia');
          expect(box).toHaveAttribute('aria-expanded', 'true');
          const option = screen.getByRole('option');
          expect(option).toHaveTextContent('Mia Legacy');
          expect(within(option).getByText('Not yet migrated')).toBeVisible();

          await user.clear(box);
          await user.type(box, 'ana');
          expect(screen.getByRole('option')).not.toHaveTextContent('Not yet migrated');
        });

        it('leaves out doulas who responded, listing Members first then Not yet migrated', async () => {
          const { user } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: [...DOULAS, { kind: 'member', id: 'member-z', displayName: 'Zoe Ali' }],
          });
          await user.type(await doulaBox(), 'a');
          // Bea has an Offline Response and Cass sent Outreach.
          expect(optionNames()).toEqual(['Ana Doula', 'Zoe Ali', 'Mia Legacy']);
        });

        it('says when nothing matches', async () => {
          const { user } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: DOULAS,
          });
          await user.type(await doulaBox(), 'xyz');
          expect(screen.queryAllByRole('option')).toHaveLength(0);
          expect(within(panel()).getByText('No matching doulas')).toBeVisible();
        });

        it('shows 8 matches at most and asks you to keep typing', async () => {
          const many: ReferralDoula[] = Array.from({ length: 12 }, (_, index) => ({
            kind: 'member',
            id: `member-${index}`,
            displayName: `Jo ${String(index).padStart(2, '0')}`,
          }));
          const { user } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: many,
          });
          await user.type(await doulaBox(), 'jo');
          expect(screen.getAllByRole('option')).toHaveLength(8);
          expect(within(panel()).getByText('Keep typing to narrow 12 matches')).toBeVisible();
        });

        it('chooses with the arrow keys and Enter, filling in the name and its label', async () => {
          const { user, recordOfflineResponse } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: DOULAS,
          });
          const box = await doulaBox();
          await user.type(box, 'a');
          await user.keyboard('{ArrowDown}{ArrowDown}');
          expect(box).toHaveAttribute(
            'aria-activedescendant',
            screen.getByRole('option', { name: /Mia Legacy/ }).id,
          );
          await user.keyboard('{Enter}');

          expect(box).toHaveValue('Mia Legacy');
          expect(box).toHaveAttribute('aria-expanded', 'false');
          expect(box).toHaveAccessibleDescription(/Not yet migrated/);
          expect(recordOfflineResponse).not.toHaveBeenCalled();

          await user.click(screen.getByRole('button', { name: 'Add Offline Response' }));
          expect(recordOfflineResponse).toHaveBeenCalledWith('req-1', DOULAS[3]);
        });

        it('closes the list on Escape without choosing', async () => {
          const { user } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: DOULAS,
          });
          const box = await doulaBox();
          await user.type(box, 'a');
          await user.keyboard('{Escape}');
          expect(box).toHaveAttribute('aria-expanded', 'false');
          expect(box).toHaveValue('a');
        });

        it('adds an Offline Response for the doula you click, then refreshes the panel', async () => {
          const { user, recordOfflineResponse, getReferral, listReferralDoulas } = await setup({
            referral: makeReferralDetail({
              responseCount: 3,
              coordinator: coordinatorView(),
            }),
            doulas: DOULAS,
          });
          const mia = { ...LEE_OFFLINE, id: 'legacy-mia', displayName: 'Mia Legacy' };
          getReferral.mockResolvedValue(
            makeReferralDetail({
              responseCount: 4,
              coordinator: coordinatorView({
                offlineResponses: [BEA_OFFLINE, LEE_OFFLINE, mia],
              }),
            }),
          );
          const box = await doulaBox();
          await user.type(box, 'mia');
          await user.click(screen.getByRole('option', { name: /Mia Legacy/ }));
          await user.click(screen.getByRole('button', { name: 'Add Offline Response' }));

          expect(recordOfflineResponse).toHaveBeenCalledWith('req-1', DOULAS[3]);
          await waitFor(() => {
            expect(within(offlineList()).getAllByRole('listitem')).toHaveLength(3);
          });
          expect(screen.getByText('4 members responded')).toBeVisible();
          expect(
            within(panel()).getByText('Recorded an Offline Response for Mia Legacy.'),
          ).toBeVisible();
          expect(box).toHaveValue('');
          // The refresh keeps the autocomplete in place rather than reloading the doulas.
          expect(listReferralDoulas).toHaveBeenCalledTimes(1);
          expect(screen.getByRole('button', { name: 'Add Offline Response' })).toHaveFocus();
        });

        it('asks you to choose a doula before adding', async () => {
          const { user, recordOfflineResponse } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: DOULAS,
          });
          await user.type(await doulaBox(), 'mia');
          await user.click(screen.getByRole('button', { name: 'Add Offline Response' }));
          expect(within(panel()).getByRole('alert')).toHaveTextContent('Choose a doula');
          expect(recordOfflineResponse).not.toHaveBeenCalled();
        });

        it('forgets the doula you chose once you edit the name', async () => {
          const { user, recordOfflineResponse } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: DOULAS,
          });
          const box = await doulaBox();
          await user.type(box, 'mia');
          await user.click(screen.getByRole('option', { name: /Mia Legacy/ }));
          await user.type(box, 'x');
          expect(box).not.toHaveAccessibleDescription(/Not yet migrated/);
          await user.click(screen.getByRole('button', { name: 'Add Offline Response' }));
          expect(within(panel()).getByRole('alert')).toHaveTextContent('Choose a doula');
          expect(recordOfflineResponse).not.toHaveBeenCalled();
        });

        it('explains a failed add', async () => {
          const { user } = await setup({
            referral: makeReferralDetail({ coordinator: coordinatorView() }),
            doulas: DOULAS,
            offlineFailure: new Error('This member already sent Outreach on this referral'),
          });
          await user.type(await doulaBox(), 'ana');
          await user.keyboard('{ArrowDown}{Enter}');
          await user.click(screen.getByRole('button', { name: 'Add Offline Response' }));
          expect(await within(panel()).findByRole('alert')).toHaveTextContent(
            'This member already sent Outreach on this referral',
          );
        });
      });

      it('shows an Admin the Offline Responses without the doula autocomplete', async () => {
        const { listReferralDoulas } = await setup({
          referral: makeReferralDetail({
            coordinator: coordinatorView({
              canRecordOfflineResponses: false,
              offlineResponses: [{ ...BEA_OFFLINE, canDelete: false }],
            }),
          }),
        });
        await screen.findByRole('heading', { name: 'Offline Responses' });
        expect(within(offlineList()).getAllByRole('listitem')).toHaveLength(1);
        expect(screen.queryByRole('combobox', { name: 'Find a doula' })).toBeNull();
        expect(within(panel()).queryByRole('button')).toBeNull();
        expect(listReferralDoulas).not.toHaveBeenCalled();
      });

      it('says when none are recorded', async () => {
        await setup({
          referral: makeReferralDetail({
            coordinator: coordinatorView({ offlineResponses: [] }),
          }),
        });
        await screen.findByRole('heading', { name: 'Offline Responses' });
        expect(within(panel()).getByText('No Offline Responses recorded')).toBeVisible();
      });
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
      '/referrals/open',
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
