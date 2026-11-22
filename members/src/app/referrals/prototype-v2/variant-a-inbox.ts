// PROTOTYPE — throwaway. Variant A: two-pane inbox (list left, referral right).
// Composer inline in the right pane. "My Outreach" is a filter chip. Outcome only in the pane.
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PrototypeComposer } from './prototype-composer';
import { PrototypeOutcome } from './prototype-outcome';
import { PrototypeRequestFacts } from './prototype-request-facts';
import {
  OUTCOME_LABELS,
  PrototypeStore,
  daysLeftLabel,
  dueLabel,
  hasHiredBadge,
  isExpiredForMe,
  reachedOutLabel,
  servicesLabel,
  submittedLabel,
} from './prototype-store';

type Filter = 'open' | 'mine' | 'needs-outcome';

@Component({
  selector: 'app-variant-a-inbox',
  imports: [RouterLink, PrototypeComposer, PrototypeOutcome, PrototypeRequestFacts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h1>Referrals</h1>
    <div class="inbox">
      <aside class="list-pane">
        <div class="chips" role="tablist">
          <button role="tab" [class.on]="filter() === 'open'" (click)="filter.set('open')">
            Open ({{ store.open().length }})
          </button>
          <button role="tab" [class.on]="filter() === 'mine'" (click)="filter.set('mine')">
            My Outreach ({{ store.mine().length }})
          </button>
          <button
            role="tab"
            [class.on]="filter() === 'needs-outcome'"
            (click)="filter.set('needs-outcome')"
          >
            Needs outcome ({{ store.needsOutcome().length }})
          </button>
        </div>
        <ul class="rows">
          @for (r of rows(); track r.id) {
            <li>
              <a
                [routerLink]="['/referrals-prototype', r.id]"
                queryParamsHandling="preserve"
                class="row"
                [class.active]="r.id === id()"
              >
                <span class="row-main">
                  <strong>{{ r.area }}</strong>
                  <span>Due {{ due(r) }} · {{ services(r) }}</span>
                </span>
                <span class="row-meta">
                  <span>{{ submitted(r) }}</span>
                  <span>{{ reachedOut(r) }}</span>
                  @if (r.myOutcome) {
                    <span class="pill mine">You: {{ outcomeLabels[r.myOutcome.value] }}</span>
                  } @else if (r.myOutreach) {
                    <span class="pill todo">You reached out · Record outcome</span>
                  }
                  @if (hired(r)) {
                    <span class="pill hired">A member was hired</span>
                  }
                </span>
              </a>
            </li>
          } @empty {
            <li class="empty">Nothing here.</li>
          }
        </ul>
      </aside>

      <section class="detail-pane">
        @if (selected(); as r) {
          @if (expired(r)) {
            <div class="closed">
              <h2>This referral is no longer open</h2>
              <p>Referrals are open for 14 days.</p>
            </div>
          } @else {
            <header>
              <p class="eyebrow">{{ submitted(r) }} · {{ daysLeft(r) }}</p>
              <h2>{{ r.firstName }} · {{ r.area }}</h2>
              <p class="meta">
                {{ reachedOut(r) }}
                @if (hired(r)) {
                  · <span class="pill hired">A member was hired</span> — you can still reach out
                }
              </p>
            </header>
            <app-proto-request-facts [referral]="r" />
            <hr />
            @if (r.myOutreach) {
              <app-proto-outcome [referral]="r" />
            } @else {
              <app-proto-composer [referral]="r" />
            }
          }
        } @else {
          <p class="empty">Select a referral.</p>
        }
      </section>
    </div>
  `,
  styles: `
    .inbox {
      display: grid;
      grid-template-columns: minmax(18rem, 2fr) 3fr;
      gap: var(--space-m);
      align-items: start;
    }
    @media (max-width: 48rem) {
      .inbox {
        grid-template-columns: 1fr;
      }
    }
    .chips {
      display: flex;
      gap: var(--space-3xs);
      flex-wrap: wrap;
      margin-block-end: var(--space-xs);
    }
    .chips button {
      border: 1px solid var(--color-line);
      background: var(--color-surface);
      border-radius: 999px;
      padding: var(--space-3xs) var(--space-xs);
      font-size: var(--step--1);
      cursor: pointer;
    }
    .chips .on {
      background: var(--color-deep);
      color: var(--color-on-deep);
      border-color: var(--color-deep);
    }
    .rows {
      list-style: none;
      margin: 0;
      padding: 0;
      border: 1px solid var(--color-line);
      border-radius: var(--border-radius-md);
      background: var(--color-surface);
    }
    .rows li + li {
      border-top: 1px solid var(--color-line);
    }
    .row {
      display: grid;
      gap: var(--space-3xs);
      padding: var(--space-xs) var(--space-s);
      color: inherit;
      text-decoration: none;
    }
    .row:hover {
      background: var(--color-ground);
    }
    .row.active {
      background: var(--color-primary-soft);
      box-shadow: inset 3px 0 var(--color-primary);
    }
    .row-main {
      display: grid;
    }
    .row-main span,
    .row-meta {
      color: var(--color-ink-soft);
      font-size: var(--step--1);
    }
    .row-meta {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2xs);
      align-items: center;
      font-size: var(--step--2);
    }
    .pill {
      border-radius: 999px;
      padding: 1px var(--space-2xs);
      font-size: var(--step--2);
    }
    .hired {
      background: var(--color-success-soft);
      color: var(--color-success);
    }
    .mine {
      background: var(--color-primary-soft);
      color: var(--color-primary-strong);
    }
    .todo {
      background: var(--color-clay-soft);
      color: var(--color-clay);
    }
    .detail-pane {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--border-radius-md);
      padding: var(--space-m);
      position: sticky;
      top: var(--space-s);
    }
    .detail-pane h2 {
      margin: 0;
    }
    .eyebrow,
    .meta {
      color: var(--color-ink-soft);
      font-size: var(--step--1);
      margin: 0;
    }
    header {
      margin-block-end: var(--space-s);
    }
    hr {
      border: 0;
      border-top: 1px solid var(--color-line);
      margin-block: var(--space-m);
    }
    .empty {
      color: var(--color-ink-soft);
      padding: var(--space-m);
      text-align: center;
    }
  `,
})
export class VariantAInbox {
  protected store = inject(PrototypeStore);
  id = input<string>();
  protected filter = signal<Filter>('open');
  protected rows = computed(() => {
    const lookup = {
      open: this.store.open(),
      mine: this.store.mine(),
      'needs-outcome': this.store.needsOutcome(),
    };
    return lookup[this.filter()];
  });
  protected selected = computed(() => this.store.byId(this.id()) ?? this.rows()[0]);
  protected outcomeLabels = OUTCOME_LABELS;
  protected due = dueLabel;
  protected services = servicesLabel;
  protected submitted = submittedLabel;
  protected reachedOut = reachedOutLabel;
  protected hired = hasHiredBadge;
  protected expired = isExpiredForMe;
  protected daysLeft = daysLeftLabel;
}
