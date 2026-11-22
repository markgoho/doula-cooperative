// PROTOTYPE — throwaway. Variant C: one dense table of every referral visible to me, with a
// status column and inline outcome select; detail + composer open in a side drawer.
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
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
  reachedOutCount,
  servicesLabel,
  submittedLabel,
  type Outcome,
  type PrototypeReferral,
} from './prototype-store';

@Component({
  selector: 'app-variant-c-table',
  imports: [RouterLink, PrototypeComposer, PrototypeOutcome, PrototypeRequestFacts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="head">
      <h1>Referrals</h1>
      <label>
        Show
        <select (change)="show.set($any($event.target).value)">
          <option value="all">Everything I can see</option>
          <option value="not-reached">Not reached out yet</option>
          <option value="mine">My Outreach</option>
        </select>
      </label>
    </div>

    @if (store.needsOutcome().length) {
      <p class="nudge">
        {{ store.needsOutcome().length }} referral(s) you reached out on still need an outcome — set
        it in the "Your outcome" column.
      </p>
    }

    <table>
      <thead>
        <tr>
          <th>Submitted</th>
          <th>Due</th>
          <th>Area</th>
          <th>Services</th>
          <th class="num">Reached out</th>
          <th>Status</th>
          <th>Your outcome</th>
        </tr>
      </thead>
      <tbody>
        @for (r of rows(); track r.id) {
          <tr [class.active]="r.id === id()">
            <td>{{ submitted(r) }}</td>
            <td>
              <a [routerLink]="['/referrals-prototype', r.id]" queryParamsHandling="preserve">
                {{ due(r) }}
              </a>
            </td>
            <td>
              {{ r.area }}
              @if (r.spanish) {
                <span class="tag">ES</span>
              }
            </td>
            <td>{{ services(r) }}</td>
            <td class="num">{{ count(r) }}</td>
            <td>
              @if (hired(r)) {
                <span class="tag hired">Hired</span>
              }
              @if (r.myOutreach) {
                <span class="tag mine">You reached out</span>
              } @else {
                <span class="soft">{{ daysLeft(r) }}</span>
              }
            </td>
            <td>
              @if (r.myOutreach) {
                <select
                  [class.todo]="!r.myOutcome"
                  [value]="r.myOutcome?.value ?? ''"
                  (change)="setOutcome(r, $any($event.target).value)"
                >
                  <option value="">— Record outcome —</option>
                  @for (o of outcomes; track o) {
                    <option [value]="o">{{ labels[o] }}</option>
                  }
                </select>
              } @else {
                <span class="soft">—</span>
              }
            </td>
          </tr>
        }
      </tbody>
    </table>

    @if (selected(); as r) {
      <button type="button" class="scrim" aria-label="Close" (click)="close()"></button>
      <aside class="drawer" role="dialog" aria-label="Referral">
        <button class="x" type="button" (click)="close()" aria-label="Close">×</button>
        @if (expired(r)) {
          <h2>This referral is no longer open</h2>
          <p>Referrals are open for 14 days.</p>
        } @else {
          <p class="soft">{{ submitted(r) }} · {{ count(r) }} reached out</p>
          <h2>{{ r.firstName }} · due {{ due(r) }}</h2>
          @if (hired(r)) {
            <p><span class="tag hired">A member was hired</span> Outreach is still open.</p>
          }
          <app-proto-request-facts [referral]="r" />
          <hr />
          @if (r.myOutreach) {
            <app-proto-outcome [referral]="r" />
          } @else if (composing()) {
            <app-proto-composer [referral]="r" />
          } @else {
            <button class="button" type="button" (click)="composing.set(true)">
              Reach out to {{ r.firstName }}
            </button>
          }
        }
      </aside>
    }
  `,
  styles: `
    .head {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      flex-wrap: wrap;
      gap: var(--space-s);
    }
    .nudge {
      background: var(--color-clay-soft);
      color: var(--color-ink);
      border-radius: var(--border-radius-md);
      padding: var(--space-2xs) var(--space-s);
      font-size: var(--step--1);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      background: var(--color-surface);
      font-size: var(--step--1);
    }
    th,
    td {
      text-align: left;
      padding: var(--space-2xs) var(--space-xs);
      border-bottom: 1px solid var(--color-line);
      vertical-align: middle;
    }
    th {
      font-size: var(--step--2);
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--color-ink-soft);
    }
    tr.active {
      background: var(--color-primary-soft);
    }
    .num {
      text-align: right;
    }
    .soft {
      color: var(--color-ink-soft);
      font-size: var(--step--2);
    }
    .tag {
      border-radius: 4px;
      padding: 1px var(--space-3xs);
      font-size: var(--step--2);
      background: var(--color-sand);
      margin-inline-start: var(--space-3xs);
    }
    .hired {
      background: var(--color-success-soft);
      color: var(--color-success);
    }
    .mine {
      background: var(--color-primary-soft);
      color: var(--color-primary-strong);
    }
    select.todo {
      border-color: var(--color-clay);
      color: var(--color-clay);
    }
    .scrim {
      position: fixed;
      inset: 0;
      border: 0;
      background: oklch(0 0 0 / 0.25);
      z-index: 50;
    }
    .drawer {
      position: fixed;
      top: 0;
      right: 0;
      bottom: 0;
      width: min(34rem, 100vw);
      background: var(--color-surface);
      z-index: 51;
      padding: var(--space-l) var(--space-m);
      overflow-y: auto;
      box-shadow: -8px 0 24px oklch(0 0 0 / 0.15);
    }
    .drawer h2 {
      margin-block: var(--space-3xs) var(--space-s);
    }
    .x {
      position: absolute;
      top: var(--space-xs);
      right: var(--space-xs);
      background: none;
      border: 0;
      font-size: var(--step-2);
      cursor: pointer;
    }
    hr {
      border: 0;
      border-top: 1px solid var(--color-line);
      margin-block: var(--space-m);
    }
    @media (max-width: 48rem) {
      table {
        display: block;
        overflow-x: auto;
      }
    }
  `,
})
export class VariantCTable {
  protected store = inject(PrototypeStore);
  private router = inject(Router);
  id = input<string>();
  protected show = signal<'all' | 'not-reached' | 'mine'>('all');
  protected composing = signal(false);
  protected rows = computed(() => {
    const visible = this.store.referrals().filter((r) => !isExpiredForMe(r));
    const lookup = {
      all: visible,
      'not-reached': visible.filter((r) => !r.myOutreach),
      mine: visible.filter((r) => r.myOutreach),
    };
    return lookup[this.show()];
  });
  protected selected = computed(() => this.store.byId(this.id()));
  protected outcomes: Outcome[] = ['hired', 'not-hired', 'not-a-fit'];
  protected labels = OUTCOME_LABELS;
  protected due = dueLabel;
  protected services = servicesLabel;
  protected submitted = submittedLabel;
  protected count = reachedOutCount;
  protected hired = hasHiredBadge;
  protected expired = isExpiredForMe;
  protected daysLeft = daysLeftLabel;

  protected setOutcome(r: PrototypeReferral, value: string) {
    this.store.setOutcome(r.id, (value || undefined) as Outcome | undefined);
  }

  protected close() {
    this.composing.set(false);
    void this.router.navigate(['/referrals-prototype'], { queryParamsHandling: 'preserve' });
  }
}
