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

/**
 * Your Referral Outcome on a Referral you reached out on: hired, not hired or
 * not a fit, plus clear. Each press saves right away. If a save fails, the
 * last saved Outcome comes back and an error explains what happened.
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
  /** Your saved Referral Outcome; undefined when none. */
  outcome = input<ReferralOutcome>();

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

  protected legend = computed(() => (this.selected() ? 'Your outcome' : 'Record outcome'));

  protected async choose(outcome: ReferralOutcome): Promise<void> {
    if (this.saving() || this.selected() === outcome) return;
    await this.save(outcome, () => this.referralsService.setOutcome(this.referralId(), outcome));
  }

  protected async clear(): Promise<void> {
    if (this.saving() || !this.selected()) return;
    // The Clear button goes away once nothing is selected; keep focus in the control.
    this.optionButtons()[0]?.nativeElement.focus();
    await this.save(undefined, () => this.referralsService.clearOutcome(this.referralId()));
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
