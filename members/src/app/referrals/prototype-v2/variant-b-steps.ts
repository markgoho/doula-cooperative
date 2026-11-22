// PROTOTYPE — throwaway. Variant B: current card grid + tabs, separate detail page with a
// 3-step flow (Review → Send Outreach → Record outcome). Outcome settable from "My Outreach" cards.
import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { PrototypeComposer } from './prototype-composer';
import { PrototypeOutcome } from './prototype-outcome';
import { PrototypeRequestFacts } from './prototype-request-facts';
import {
  PrototypeStore,
  daysLeftLabel,
  dueLabel,
  hasHiredBadge,
  isExpiredForMe,
  reachedOutLabel,
  servicesLabel,
  submittedLabel,
} from './prototype-store';

@Component({
  selector: 'app-variant-b-steps',
  imports: [RouterLink, PrototypeComposer, PrototypeOutcome, PrototypeRequestFacts],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    @if (selected(); as r) {
      <a routerLink="/referrals-prototype" queryParamsHandling="preserve" class="back">
        ← Back to referrals
      </a>
      @if (expired(r)) {
        <div class="closed">
          <h1>This referral is no longer open</h1>
          <p>Referrals are open for 14 days.</p>
        </div>
      } @else {
        <header class="detail-head">
          <p class="eyebrow">Referral request · {{ submitted(r) }} · {{ daysLeft(r) }}</p>
          <h1>{{ r.firstName }}, due {{ due(r) }}</h1>
          <p class="meta">
            {{ reachedOut(r) }}
            @if (hired(r)) {
              · <span class="badge hired">A member was hired</span>
            }
          </p>
        </header>

        <ol class="steps">
          <li class="done"><span>1</span> Review request</li>
          <li [class.done]="!!r.myOutreach" [class.current]="!r.myOutreach">
            <span>2</span> Send Outreach
          </li>
          <li [class.done]="!!r.myOutcome" [class.current]="!!r.myOutreach && !r.myOutcome">
            <span>3</span> Record outcome
          </li>
        </ol>

        <section class="panel">
          <h2>Request</h2>
          <app-proto-request-facts [referral]="r" />
        </section>

        <section class="panel">
          <h2>Outreach</h2>
          @if (r.myOutreach) {
            <p class="sent">✓ Sent. {{ r.firstName }}'s contact details are above.</p>
          } @else {
            @if (hired(r)) {
              <p class="note">
                Another member was hired, but {{ r.firstName }} may still want options.
              </p>
            }
            <app-proto-composer [referral]="r" />
          }
        </section>

        @if (r.myOutreach) {
          <section class="panel">
            <h2>Outcome</h2>
            <app-proto-outcome [referral]="r" />
          </section>
        }
      }
    } @else {
      <h1>Referrals</h1>
      <div class="tabs" role="tablist">
        <button role="tab" [class.on]="tab() === 'open'" (click)="tab.set('open')">
          Open referrals
        </button>
        <button role="tab" [class.on]="tab() === 'mine'" (click)="tab.set('mine')">
          My Outreach
          @if (store.needsOutcome().length) {
            <span class="count">{{ store.needsOutcome().length }}</span>
          }
        </button>
      </div>

      @if (tab() === 'open') {
        <p class="note">Referral requests from the last 14 days.</p>
      } @else {
        <p class="note">Every referral you reached out on, including ones past 14 days.</p>
      }

      <ul class="cards">
        @for (r of cards(); track r.id) {
          <li class="card">
            <div class="card-top">
              <strong>Due {{ due(r) }}</strong>
              <span class="soft">{{ submitted(r) }}</span>
            </div>
            <div>{{ r.area }} · {{ r.birthLocation }}</div>
            <div class="soft">{{ services(r) }}</div>
            <div class="card-foot">
              <span class="soft">{{ reachedOut(r) }}</span>
              @if (hired(r)) {
                <span class="badge hired">A member was hired</span>
              }
              @if (r.myOutreach && tab() === 'open') {
                <span class="badge mine">You reached out</span>
              }
            </div>
            @if (tab() === 'mine') {
              <app-proto-outcome [referral]="r" [compact]="true" />
            }
            <a
              [routerLink]="['/referrals-prototype', r.id]"
              queryParamsHandling="preserve"
              class="view"
            >
              {{ r.myOutreach ? 'View' : 'View & reach out' }} →
            </a>
          </li>
        } @empty {
          <li class="soft">Nothing here yet.</li>
        }
      </ul>
    }
  `,
  styles: `
    .tabs {
      display: flex;
      gap: var(--space-m);
      border-bottom: 1px solid var(--color-line);
      margin-block-end: var(--space-s);
    }
    .tabs button {
      background: none;
      border: 0;
      border-bottom: 3px solid transparent;
      padding: var(--space-2xs) 0;
      font-size: var(--step-0);
      cursor: pointer;
      color: var(--color-ink-soft);
    }
    .tabs .on {
      border-bottom-color: var(--color-primary);
      color: var(--color-ink);
      font-weight: 600;
    }
    .count {
      background: var(--color-clay);
      color: var(--color-on-clay);
      border-radius: 999px;
      padding: 0 0.45em;
      font-size: var(--step--2);
      margin-inline-start: var(--space-3xs);
    }
    .note {
      background: var(--color-primary-soft);
      border-radius: var(--border-radius-md);
      font-size: var(--step--1);
      padding: var(--space-2xs) var(--space-s);
    }
    .cards {
      list-style: none;
      padding: 0;
      margin: 0;
      display: grid;
      gap: var(--space-s);
      grid-template-columns: repeat(auto-fill, minmax(18rem, 1fr));
    }
    .card {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--border-radius-md);
      padding: var(--space-s);
      display: grid;
      gap: var(--space-2xs);
    }
    .card-top {
      display: flex;
      justify-content: space-between;
    }
    .card-foot {
      display: flex;
      flex-wrap: wrap;
      gap: var(--space-2xs);
      align-items: center;
      border-top: 1px solid var(--color-line);
      padding-top: var(--space-2xs);
    }
    .soft {
      color: var(--color-ink-soft);
      font-size: var(--step--1);
    }
    .badge {
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
    .view {
      justify-self: end;
      font-weight: 600;
    }
    .back {
      display: inline-block;
      margin-block-end: var(--space-s);
    }
    .eyebrow,
    .meta {
      color: var(--color-ink-soft);
      font-size: var(--step--1);
      margin: 0;
    }
    .detail-head h1 {
      margin-block: var(--space-3xs);
    }
    .steps {
      list-style: none;
      padding: 0;
      display: flex;
      gap: var(--space-s);
      margin-block: var(--space-m);
      flex-wrap: wrap;
    }
    .steps li {
      display: flex;
      align-items: center;
      gap: var(--space-2xs);
      color: var(--color-ink-soft);
    }
    .steps span {
      display: inline-grid;
      place-items: center;
      width: 1.75em;
      height: 1.75em;
      border-radius: 50%;
      border: 2px solid var(--color-line-strong);
      font-size: var(--step--1);
    }
    .steps .done span {
      background: var(--color-primary);
      border-color: var(--color-primary);
      color: var(--color-on-primary);
    }
    .steps .current {
      color: var(--color-ink);
      font-weight: 600;
    }
    .steps .current span {
      border-color: var(--color-primary);
    }
    .panel {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--border-radius-md);
      padding: var(--space-m);
      margin-block-end: var(--space-s);
    }
    .panel h2 {
      font-size: var(--step-1);
      margin-block: 0 var(--space-s);
    }
    .sent {
      color: var(--color-success);
      margin: 0;
    }
  `,
})
export class VariantBSteps {
  protected store = inject(PrototypeStore);
  id = input<string>();
  protected tab = signal<'open' | 'mine'>('open');
  protected cards = computed(() => (this.tab() === 'open' ? this.store.open() : this.store.mine()));
  protected selected = computed(() => this.store.byId(this.id()));
  protected due = dueLabel;
  protected services = servicesLabel;
  protected submitted = submittedLabel;
  protected reachedOut = reachedOutLabel;
  protected hired = hasHiredBadge;
  protected expired = isExpiredForMe;
  protected daysLeft = daysLeftLabel;
}
