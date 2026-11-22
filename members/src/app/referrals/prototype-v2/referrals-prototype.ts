// PROTOTYPE — throwaway, never merge to trunk.
// Three variants of the Referral Portal v2 list + detail, switchable via ?variant=A|B|C,
// on an unguarded dev-only route /referrals-prototype(/:id). Stub data, in-memory only.
// Question (ticket #107): how should list, detail, Outreach composer, contact reveal and
// Referral Outcome look and behave?
import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PrototypeSwitcher } from '../../shared/prototype-switcher/prototype-switcher';
import { PrototypeStore, OUTCOME_LABELS } from './prototype-store';
import { VariantAInbox } from './variant-a-inbox';
import { VariantBSteps } from './variant-b-steps';
import { VariantCTable } from './variant-c-table';

const VARIANTS: Record<string, string> = {
  A: 'Two-pane inbox',
  B: 'Cards + step flow',
  C: 'Table + drawer',
};

@Component({
  imports: [RouterLink, PrototypeSwitcher, VariantAInbox, VariantBSteps, VariantCTable],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @switch (current()) {
      @case ('B') {
        <app-variant-b-steps [id]="id()" />
      }
      @case ('C') {
        <app-variant-c-table [id]="id()" />
      }
      @default {
        <app-variant-a-inbox [id]="id()" />
      }
    }

    <details class="state">
      <summary>Prototype state</summary>
      <label>
        <input
          type="checkbox"
          [checked]="store.failNextSend()"
          (change)="store.failNextSend.set($any($event.target).checked)"
        />
        Simulate failure on next send
      </label>
      <p>
        <button type="button" (click)="store.reset()">Reset data</button>
        <a [routerLink]="['/referrals-prototype', 'r7']" queryParamsHandling="preserve">
          Open expired link (r7)
        </a>
      </p>
      <table>
        <tr>
          <th>id</th>
          <th>days</th>
          <th>others</th>
          <th>othersHired</th>
          <th>mine</th>
          <th>outcome</th>
        </tr>
        @for (r of store.referrals(); track r.id) {
          <tr>
            <td>{{ r.id }}</td>
            <td>{{ r.submittedDaysAgo }}</td>
            <td>{{ r.othersReachedOut }}</td>
            <td>{{ r.othersHired ? 'yes' : '' }}</td>
            <td>{{ r.myOutreach ? 'sent' : '' }}</td>
            <td>{{ r.myOutcome ? labels[r.myOutcome.value] : '' }}</td>
          </tr>
        }
      </table>
    </details>

    <app-prototype-switcher [variants]="variants" [current]="current()" />
  `,
  styles: `
    :host {
      display: block;
      padding-block-end: 6rem;
    }
    .state {
      position: fixed;
      left: 12px;
      bottom: 12px;
      z-index: 1000;
      max-width: 26rem;
      background: #111;
      color: #eee;
      border-radius: 8px;
      padding: 6px 10px;
      font:
        12px/1.4 ui-monospace,
        monospace;
    }
    .state summary {
      cursor: pointer;
    }
    .state a {
      color: #9cf;
      margin-inline-start: 8px;
    }
    .state td,
    .state th {
      padding: 0 6px;
      text-align: left;
    }
  `,
})
export class ReferralsPrototype {
  protected store = inject(PrototypeStore);
  id = input<string>();
  variant = input<string>();
  protected variants = VARIANTS;
  protected labels = OUTCOME_LABELS;
  protected current = computed(() => {
    const v = this.variant() ?? 'A';
    return Object.hasOwn(VARIANTS, v) ? v : 'A';
  });
}
