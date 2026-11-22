// PROTOTYPE — throwaway. Referral Outcome control shared by all variants.
import { ChangeDetectionStrategy, Component, inject, input } from '@angular/core';
import {
  OUTCOME_LABELS,
  PrototypeStore,
  type Outcome,
  type PrototypeReferral,
} from './prototype-store';

@Component({
  selector: 'app-proto-outcome',
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <fieldset class="outcome" [class.compact]="compact()">
      <legend>
        @if (referral().myOutcome) {
          Your outcome
        } @else {
          <span class="prompt">Record outcome</span>
        }
      </legend>
      <div class="options">
        @for (option of options; track option) {
          <button
            type="button"
            class="option"
            [class.selected]="referral().myOutcome?.value === option"
            [attr.aria-pressed]="referral().myOutcome?.value === option"
            (click)="store.setOutcome(referral().id, option)"
          >
            {{ labels[option] }}
          </button>
        }
        @if (referral().myOutcome) {
          <button type="button" class="clear" (click)="store.setOutcome(referral().id, undefined)">
            Clear
          </button>
        }
      </div>
      @if (!compact()) {
        <p class="hint">
          Only admins see your answer. Other members only see "A member was hired".
        </p>
      }
    </fieldset>
  `,
  styles: `
    .outcome {
      border: 0;
      margin: 0;
      padding: 0;
      display: grid;
      gap: var(--space-2xs);
    }
    legend {
      font-weight: 600;
      font-size: var(--step--1);
      padding: 0;
      margin-block-end: var(--space-2xs);
    }
    .prompt {
      color: var(--color-clay);
    }
    .options {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-3xs);
    }
    .option {
      border: 1px solid var(--color-line-strong);
      background: var(--color-surface);
      border-radius: 999px;
      padding: var(--space-3xs) var(--space-xs);
      font-size: var(--step--1);
      cursor: pointer;
    }
    .option.selected {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-on-primary);
    }
    .clear {
      background: none;
      border: 0;
      color: var(--color-ink-soft);
      text-decoration: underline;
      cursor: pointer;
      font-size: var(--step--2);
    }
    .hint {
      color: var(--color-ink-soft);
      font-size: var(--step--2);
      margin: 0;
    }
    .compact legend {
      font-size: var(--step--2);
    }
    .compact .option {
      font-size: var(--step--2);
      padding: 2px var(--space-2xs);
    }
  `,
})
export class PrototypeOutcome {
  protected store = inject(PrototypeStore);
  referral = input.required<PrototypeReferral>();
  compact = input(false);
  protected options: Outcome[] = ['hired', 'not-hired', 'not-a-fit'];
  protected labels = OUTCOME_LABELS;
}
