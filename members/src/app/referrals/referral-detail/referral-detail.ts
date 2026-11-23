import {
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  resource,
  viewChild,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { formatDaysOpen } from '../format-days-open';
import { formatDueDate } from '../format-due-date';
import { formatResponseCount } from '../format-response-count';
import { formatServices } from '../format-services';
import { MembershipRequiredError } from '../membership-required-error';
import { ReferralNotOpenError } from '../referral-not-open-error';
import { ReferralPortalDisabledError } from '../referral-portal-disabled-error';
import { getRelativeTime } from '../referral.utilities';
import { ReferralsService } from '../../services/referrals.service';

/**
 * Right pane of the Referral inbox: the selected Referral before Outreach.
 * Shows request facts and where contact details will appear; never the
 * requester's full name, email or phone.
 */
@Component({
  selector: 'app-referral-detail',
  imports: [RouterLink],
  templateUrl: './referral-detail.html',
  styleUrl: './referral-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralDetail {
  private referralsService = inject(ReferralsService);

  // Route parameter binding via withComponentInputBinding
  id = input.required<string>();

  private heading = viewChild<ElementRef<HTMLElement>>('heading');

  protected referralResource = resource({
    params: () => ({ id: this.id() }),
    loader: ({ params }) => this.referralsService.getReferral(params.id),
  });

  protected isNotOpen = computed(
    () => this.referralResource.error() instanceof ReferralNotOpenError,
  );

  /** The inbox page shows these states in place of both panes. */
  protected isHandledByPage = computed(() => {
    const error = this.referralResource.error();
    return error instanceof ReferralPortalDisabledError || error instanceof MembershipRequiredError;
  });

  protected view = computed(() => {
    if (!this.referralResource.hasValue()) return;
    const referral = this.referralResource.value();
    const firstName = referral.firstName || 'The requester';
    return {
      referral,
      title: [referral.firstName, referral.area].filter(Boolean).join(' · ') || 'Referral',
      submitted: getRelativeTime(referral.submitted),
      daysOpen: formatDaysOpen(referral.submitted),
      responses: formatResponseCount(referral.responseCount),
      dueDate: formatDueDate(referral.estimatedDueDate) ?? 'Not provided',
      services: formatServices(referral.services) || 'Not provided',
      area: this.formatArea(referral.area, referral.zipcode),
      costOffset: referral.insurance.join(', ') || 'Not provided',
      contactHint: `${firstName}'s full name, email, and phone appear after you send Outreach.`,
    };
  });

  constructor() {
    // Move focus to the selected Referral so it is announced, and scrolled
    // into view when the panes stack on narrow screens.
    afterRenderEffect(() => {
      this.heading()?.nativeElement.focus();
    });
  }

  private formatArea(area: string, zipcode: string): string {
    if (area && zipcode) return `${area} (${zipcode})`;
    return area || zipcode || 'Not provided';
  }
}
