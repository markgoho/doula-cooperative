import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  resource,
  signal,
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
import type { ReferralListItem } from './referral.types';
import { getRelativeTime } from './referral.utilities';
import { ReferralsService } from '../services/referrals.service';

/** List filters. Needs outcome joins once Referral Outcomes exist. */
type ReferralFilter = 'open' | 'mine';

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
  // Every Referral you reached out on, at any age.
  mine: {
    label: 'My Outreach',
    empty: "You haven't sent Outreach yet.",
    select: (referrals) => referrals.filter((referral) => referral.outreach !== undefined),
  },
};

const FILTER_IDS = Object.keys(REFERRAL_FILTERS) as ReferralFilter[];

/**
 * Two-pane Referral inbox: the list on the left, the selected Referral
 * (child route `/referrals/:id`) on the right. The panes stack on narrow screens.
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

  protected filter = signal<ReferralFilter>('open');

  protected filterOptions = computed(() => {
    const referrals = this.referralsResource.hasValue() ? this.referralsResource.value() : [];
    return FILTER_IDS.map((id) => ({
      id,
      label: REFERRAL_FILTERS[id].label,
      count: REFERRAL_FILTERS[id].select(referrals).length,
    }));
  });

  protected rows = computed(() => {
    if (!this.referralsResource.hasValue()) return [];
    return REFERRAL_FILTERS[this.filter()].select(this.referralsResource.value());
  });

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
}
