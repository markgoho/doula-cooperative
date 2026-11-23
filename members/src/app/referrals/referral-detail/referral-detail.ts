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
import { formatSentAt } from '../format-sent-at';
import { formatServices } from '../format-services';
import { MembershipRequiredError } from '../membership-required-error';
import { ReferralNotOpenError } from '../referral-not-open-error';
import { ReferralPortalDisabledError } from '../referral-portal-disabled-error';
import { ReferralListRefresh } from '../referral-list-refresh';
import { ReferralOutcomeControl } from '../referral-outcome-control/referral-outcome-control';
import { ReferralOutreachComposer } from '../referral-outreach-composer/referral-outreach-composer';
import { ReferralResponsesPanel } from '../referral-responses-panel/referral-responses-panel';
import type { ReferralOutcomeState, SentOutreach } from '../referral.types';
import { getRelativeTime } from '../referral.utilities';
import { ReferralsService } from '../../services/referrals.service';

/**
 * Right pane of the Referral inbox: the selected Referral.
 * Before your Outreach: request facts, where contact details will appear, and
 * the composer; never the requester's full name, email or phone. After it:
 * the revealed contact details with the sent time, then your Referral Outcome.
 * Everyone sees the hired badge once any member is hired; it never closes the
 * Referral to Outreach.
 */
@Component({
  selector: 'app-referral-detail',
  imports: [RouterLink, ReferralOutreachComposer, ReferralOutcomeControl, ReferralResponsesPanel],
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
      contactHint: referral.isOpen
        ? `${firstName}'s full name, email, and phone appear after you send Outreach.`
        : 'This referral is past its 14 days, so Outreach is closed.',
      sentAt: referral.outreach ? formatSentAt(referral.outreach.sentAt) : '',
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
      // An Offline Response already counted you.
      responseCount: referral.offlineResponse ? referral.responseCount : referral.responseCount + 1,
    };
    // The composer's sender no longer applies once Outreach is sent.
    delete updated.outreachSender;
    this.referralResource.set(updated);
    this.listRefresh.request();
    void this.refreshCoordinatorView();
    // The composer is gone; move focus to the revealed contact details.
    afterNextRender(() => this.contactHeading()?.nativeElement.focus(), {
      injector: this.injector,
    });
  }

  /**
   * Keep the pane in step with a saved Referral Outcome without reloading it
   * (a reload would replace the control and drop focus), and refresh the list row.
   */
  protected onOutcomeSaved(state: ReferralOutcomeState): void {
    if (!this.referralResource.hasValue()) return;
    const updated = { ...this.referralResource.value() };
    // The saved state replaces your Outcome entirely; a cleared one has neither field.
    delete updated.outcome;
    delete updated.outcomeUpdatedAt;
    this.referralResource.set({ ...updated, ...state });
    this.listRefresh.request();
    void this.refreshCoordinatorView();
  }

  /** An Offline Response was added or deleted: refresh the panel, the count and the list row. */
  protected onOfflineResponsesChanged(): void {
    this.listRefresh.request();
    void this.refreshCoordinatorView();
  }

  /**
   * A Coordinator's own Outreach, Outcome or Offline Responses also appear in
   * her Responses panel. Re-fetch in the background and swap in only that
   * block and the count, so the pane is not replaced and focus stays put. On
   * failure the panel keeps its last state; it refreshes on the next open.
   */
  private async refreshCoordinatorView(): Promise<void> {
    if (!this.referralResource.hasValue() || !this.referralResource.value().coordinator) return;
    const id = this.id();
    try {
      const { coordinator, responseCount } = await this.referralsService.getReferral(id);
      if (!coordinator || this.id() !== id || !this.referralResource.hasValue()) return;
      this.referralResource.set({ ...this.referralResource.value(), coordinator, responseCount });
    } catch (error: unknown) {
      console.error('Failed to refresh the Responses panel', { id, error });
    }
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
