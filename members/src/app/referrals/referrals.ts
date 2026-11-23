import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { formatDueDate } from './format-due-date';
import { formatResponseCount } from './format-response-count';
import { formatServices } from './format-services';
import { MembershipRequiredError } from './membership-required-error';
import { ReferralMembershipRequired } from './referral-membership-required/referral-membership-required';
import { ReferralPortalDisabledError } from './referral-portal-disabled-error';
import { ReferralPortalUnavailable } from './referral-portal-unavailable/referral-portal-unavailable';
import type { ReferralListItem } from './referral.types';
import { getRelativeTime } from './referral.utilities';
import { ReferralsService } from '../services/referrals.service';

/** List filters. My Outreach and Needs outcome join once Outreach and Referral Outcomes exist. */
type ReferralFilter = 'open';

const REFERRAL_FILTERS: Record<
  ReferralFilter,
  { label: string; select: (referrals: ReferralListItem[]) => ReferralListItem[] }
> = {
  // The API lists only open Referrals (last 14 days).
  open: { label: 'Open', select: (referrals) => referrals },
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

  protected referralsResource = resource({
    loader: () => this.referralsService.listReferrals(),
  });

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
