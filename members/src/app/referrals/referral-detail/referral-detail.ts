import {
  afterNextRender,
  afterRenderEffect,
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  Injector,
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
import { ReferralListRefresh } from '../referral-list-refresh';
import { ReferralOutreachComposer } from '../referral-outreach-composer/referral-outreach-composer';
import type { SentOutreach } from '../referral.types';
import { getRelativeTime } from '../referral.utilities';
import { ReferralsService } from '../../services/referrals.service';

const SENT_AT_FORMAT = new Intl.DateTimeFormat('en-US', {
  month: 'short',
  day: 'numeric',
  hour: 'numeric',
  minute: '2-digit',
});

/**
 * Right pane of the Referral inbox: the selected Referral.
 * Before your Outreach: request facts, where contact details will appear, and
 * the composer; never the requester's full name, email or phone. After it:
 * the revealed contact details with the sent time.
 */
@Component({
  selector: 'app-referral-detail',
  imports: [RouterLink, ReferralOutreachComposer],
  templateUrl: './referral-detail.html',
  styleUrl: './referral-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralDetail {
  private referralsService = inject(ReferralsService);
  private listRefresh = inject(ReferralListRefresh);

  // Route parameter binding via withComponentInputBinding
  id = input.required<string>();

  private heading = viewChild<ElementRef<HTMLElement>>('heading');
  private contactHeading = viewChild<ElementRef<HTMLElement>>('contactHeading');
  private injector = inject(Injector);

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
      sentAt: referral.outreach ? SENT_AT_FORMAT.format(new Date(referral.outreach.sentAt)) : '',
    };
  });

  /** Reveal the contact details in place and refresh the list row. */
  protected onOutreachSent({ outreach, contact }: SentOutreach): void {
    if (!this.referralResource.hasValue()) return;
    const referral = this.referralResource.value();
    const updated = {
      ...referral,
      outreach,
      contact,
      responseCount: referral.responseCount + 1,
    };
    // The composer's sender no longer applies once Outreach is sent.
    delete updated.outreachSender;
    this.referralResource.set(updated);
    this.listRefresh.request();
    // The composer is gone; move focus to the revealed contact details.
    afterNextRender(() => this.contactHeading()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

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
