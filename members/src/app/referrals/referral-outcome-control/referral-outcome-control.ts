import {
  ChangeDetectionStrategy,
  Component,
  computed,
  type ElementRef,
  inject,
  input,
  linkedSignal,
  output,
  signal,
  viewChildren,
} from '@angular/core';
import { ReferralsService } from '../../services/referrals.service';
import { OUTCOME_LABELS } from '../referral.constants';
import type { ReferralOutcome, ReferralOutcomeState } from '../referral.types';

const OUTCOME_OPTIONS = Object.keys(OUTCOME_LABELS) as ReferralOutcome[];

/** Gives each control its own hint id, since a Coordinator panel shows several. */
let nextHintId = 0;

/** A doula not yet migrated, whose Outcome a Referral Coordinator records for them. */
export interface LegacyOutcomeDoula {
  /** The opaque id the Coordinator panel lists. */
  id: string;
  name: string;
}

/**
 * A Referral Outcome on a Referral: hired, not hired or not a fit, plus
 * clear. Each press saves right away. If a save fails, the last saved Outcome
 * comes back and an error explains what happened.
 *
 * By default it's your own, on a Referral you responded to. Given
 * `legacyDoula`, it's that not-yet-migrated doula's, which a Referral
 * Coordinator records since the doula has no portal account.
 *
 * Toggle buttons rather than radios: a radio group changes on arrow keys, and
 * each change here is a save.
 */
@Component({
  selector: 'app-referral-outcome-control',
  templateUrl: './referral-outcome-control.html',
  styleUrl: './referral-outcome-control.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralOutcomeControl {
  private referralsService = inject(ReferralsService);

  referralId = input.required<string>();
  /** The saved Referral Outcome; undefined when none. */
  outcome = input<ReferralOutcome>();
  /** Record this doula's Outcome instead of your own. */
  legacyDoula = input<LegacyOutcomeDoula>();

  protected hintId = `outcome-hint-${nextHintId++}`;

  /** Emits after each successful save, with the saved Outcome and hired badge. */
  saved = output<ReferralOutcomeState>();

  private optionButtons = viewChildren<ElementRef<HTMLButtonElement>>('optionButton');

  protected readonly options = OUTCOME_OPTIONS.map((value) => ({
    value,
    label: OUTCOME_LABELS[value],
  }));

  /** What the control shows: the saved Outcome, or the one being saved. */
  protected selected = linkedSignal(() => this.outcome());
  protected saving = signal(false);
  protected status = signal('');
  protected saveError = signal('');

  protected legend = computed(() => {
    const doula = this.legacyDoula();
    if (doula) return `Outcome for ${doula.name}`;
    return this.selected() ? 'Your outcome' : 'Record outcome';
  });

  protected async choose(outcome: ReferralOutcome): Promise<void> {
    if (this.saving() || this.selected() === outcome) return;
    const doula = this.legacyDoula();
    await this.save(outcome, () =>
      doula
        ? this.referralsService.setLegacyOutcome(this.referralId(), doula.id, outcome)
        : this.referralsService.setOutcome(this.referralId(), outcome),
    );
  }

  protected async clear(): Promise<void> {
    if (this.saving() || !this.selected()) return;
    // The Clear button goes away once nothing is selected; keep focus in the control.
    this.optionButtons()[0]?.nativeElement.focus();
    const doula = this.legacyDoula();
    await this.save(undefined, () =>
      doula
        ? this.referralsService.clearLegacyOutcome(this.referralId(), doula.id)
        : this.referralsService.clearOutcome(this.referralId()),
    );
  }

  private async save(
    next: ReferralOutcome | undefined,
    request: () => Promise<ReferralOutcomeState>,
  ): Promise<void> {
    const previous = this.selected();
    this.selected.set(next);
    this.saving.set(true);
    this.saveError.set('');
    this.status.set('Saving…');
    try {
      const result = await request();
      this.status.set(next ? 'Saved' : 'Outcome cleared');
      this.saved.emit(result);
    } catch (error: unknown) {
      this.selected.set(previous);
      this.status.set('');
      this.saveError.set(
        error instanceof Error ? error.message : "Your outcome wasn't saved. Please try again.",
      );
    } finally {
      this.saving.set(false);
    }
  }
}
