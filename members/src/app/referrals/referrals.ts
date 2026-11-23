import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  resource,
  untracked,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { formatDueDate } from './format-due-date';
import { formatResponseCount } from './format-response-count';
import { formatServices } from './format-services';
import { MembershipRequiredError } from './membership-required-error';
import { ReferralListRefresh } from './referral-list-refresh';
import { ReferralMembershipRequired } from './referral-membership-required/referral-membership-required';
import { ReferralPortalDisabledError } from './referral-portal-disabled-error';
import { ReferralPortalUnavailable } from './referral-portal-unavailable/referral-portal-unavailable';
import { OUTCOME_LABELS } from './referral.constants';
import type { ReferralFilter, ReferralListItem } from './referral.types';
import { getRelativeTime } from './referral.utilities';
import { ReferralsService } from '../services/referrals.service';

/** Whether you sent Outreach on this Referral, or an Offline Response names you. */
function hasResponded(referral: ReferralListItem): boolean {
  return referral.outreach !== undefined || referral.offlineResponse !== undefined;
}

const REFERRAL_FILTERS: Record<
  ReferralFilter,
  {
    label: string;
    empty: string;
    select: (referrals: ReferralListItem[]) => ReferralListItem[];
  }
> = {
  open: {
    label: 'Open',
    empty: 'No open referrals right now. Check back soon.',
    select: (referrals) => referrals.filter((referral) => referral.isOpen),
  },
  // Every Referral you responded to, at any age: your Outreach, or an
  // Offline Response the Referral Coordinator recorded for you.
  'my-outreach': {
    label: 'My Outreach',
    empty: "You haven't sent Outreach yet.",
    select: (referrals) => referrals.filter((referral) => hasResponded(referral)),
  },
  // Referrals you responded to with no Referral Outcome yet.
  'needs-outcome': {
    label: 'Needs outcome',
    empty: 'Nothing to record. After you send Outreach, record how it went here.',
    select: (referrals) =>
      referrals.filter((referral) => hasResponded(referral) && !referral.outcome),
  },
  // Every Referral regardless of age, for the Referral Coordinator.
  all: {
    label: 'All referrals',
    empty: 'No referrals yet.',
    select: (referrals) => referrals,
  },
};

const MEMBER_FILTER_IDS: ReferralFilter[] = ['open', 'my-outreach', 'needs-outcome'];
const COORDINATOR_FILTER_IDS: ReferralFilter[] = [...MEMBER_FILTER_IDS, 'all'];

/** Your own state on a list row, when you reached out. */
function ownState(
  referral: ReferralListItem,
): { label: string; tone: 'mine' | 'todo' } | undefined {
  if (referral.outcome) {
    return { label: `You: ${OUTCOME_LABELS[referral.outcome]}`, tone: 'mine' };
  }
  if (referral.outreach) return { label: 'You reached out · Record outcome', tone: 'todo' };
  if (referral.offlineResponse) {
    return { label: 'You responded outside the portal · Record outcome', tone: 'todo' };
  }
  return undefined;
}

/**
 * Two-pane Referral inbox: the list on the left, filtered by the route
 * (`/referrals/:filter`), and the selected Referral (child route
 * `/referrals/:filter/:id`) on the right. The panes stack on narrow screens.
 */
@Component({
  imports: [
    RouterLink,
    RouterLinkActive,
    RouterOutlet,
    ReferralPortalUnavailable,
    ReferralMembershipRequired,
  ],
  templateUrl: './referrals.html',
  styleUrl: './referrals.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Referrals {
  /** The list filter, bound from the `:filter` route param. */
  readonly filter = input.required<ReferralFilter>();

  private referralsService = inject(ReferralsService);
  private listRefresh = inject(ReferralListRefresh);

  protected referralsResource = resource({
    loader: () => this.referralsService.listReferrals(),
  });

  constructor() {
    // Reload (keeping the current rows on screen) when the pane reports a
    // change, such as sent Outreach.
    effect(() => {
      if (this.listRefresh.version() === 0) return;
      untracked(() => this.referralsResource.reload());
    });
  }

  protected emptyMessage = computed(() => REFERRAL_FILTERS[this.filter()].empty);

  protected isPortalDisabled = computed(
    () => this.referralsResource.error() instanceof ReferralPortalDisabledError,
  );

  protected isMembershipRequired = computed(
    () => this.referralsResource.error() instanceof MembershipRequiredError,
  );

  private list = computed(() =>
    this.referralsResource.hasValue()
      ? this.referralsResource.value()
      : { referrals: [], showsAllReferrals: false },
  );

  protected filterOptions = computed(() => {
    const { referrals, showsAllReferrals } = this.list();
    const ids = showsAllReferrals ? COORDINATOR_FILTER_IDS : MEMBER_FILTER_IDS;
    return ids.map((id) => ({
      id,
      label: REFERRAL_FILTERS[id].label,
      count: REFERRAL_FILTERS[id].select(referrals).length,
    }));
  });

  protected rows = computed(() => REFERRAL_FILTERS[this.filter()].select(this.list().referrals));

  protected dueDate(referral: ReferralListItem): string {
    return formatDueDate(referral.estimatedDueDate) ?? 'not provided';
  }

  protected services(referral: ReferralListItem): string {
    return formatServices(referral.services) || 'No services listed';
  }

  protected submitted(referral: ReferralListItem): string {
    return getRelativeTime(referral.submitted);
  }

  protected responses(referral: ReferralListItem): string {
    return formatResponseCount(referral.responseCount);
  }

  protected ownState = ownState;
}
