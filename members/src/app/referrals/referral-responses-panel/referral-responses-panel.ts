import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { formatSentAt } from '../format-sent-at';
import { OUTCOME_LABELS } from '../referral.constants';
import type { ReferralResponse } from '../referral.types';

/**
 * Coordinator-only panel in the Referral pane: each member who sent Outreach,
 * when, and their Referral Outcome. Shown only when the API includes the
 * Coordinator view (Referral Coordinators and Admins).
 */
@Component({
  selector: 'app-referral-responses-panel',
  templateUrl: './referral-responses-panel.html',
  styleUrl: './referral-responses-panel.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralResponsesPanel {
  /** Members who sent Outreach, earliest first. */
  responses = input.required<ReferralResponse[]>();

  protected rows = computed(() =>
    this.responses().map((response) => ({
      memberUid: response.memberUid,
      name: response.memberName || 'Name not set',
      sentAt: response.outreachSentAt,
      sentAtLabel: formatSentAt(response.outreachSentAt),
      outcome: response.outcome ? OUTCOME_LABELS[response.outcome] : 'No outcome yet',
      hasOutcome: response.outcome !== undefined,
    })),
  );
}
