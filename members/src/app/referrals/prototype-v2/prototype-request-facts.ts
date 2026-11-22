// PROTOTYPE — throwaway. Request facts + contact block (hidden until Outreach). Shared by variants.
import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { DatePipe } from '@angular/common';
import { dueLabel, servicesLabel, type PrototypeReferral } from './prototype-store';

@Component({
  selector: 'app-proto-request-facts',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <dl class="facts">
      <div>
        <dt>Due</dt>
        <dd>{{ due(referral()) }}</dd>
      </div>
      <div>
        <dt>Services</dt>
        <dd>{{ services(referral()) }}</dd>
      </div>
      <div>
        <dt>Area</dt>
        <dd>{{ referral().area }} ({{ referral().zipcode }})</dd>
      </div>
      <div>
        <dt>Birth location</dt>
        <dd>{{ referral().birthLocation || 'Not provided' }}</dd>
      </div>
      <div>
        <dt>Cost offset</dt>
        <dd>{{ referral().costOffset.join(', ') || 'Not provided' }}</dd>
      </div>
      @if (referral().spanish) {
        <div>
          <dt>Language</dt>
          <dd>Requester prefers Spanish</dd>
        </div>
      }
      @if (referral().notes) {
        <div class="wide">
          <dt>Notes</dt>
          <dd>{{ referral().notes }}</dd>
        </div>
      }
    </dl>

    @if (showContact()) {
      @if (referral().myOutreach; as outreach) {
        <section class="contact revealed">
          <h3>{{ referral().firstName }} {{ referral().lastName }}</h3>
          <p>
            <a [href]="'mailto:' + referral().email">{{ referral().email }}</a> ·
            <a [href]="'tel:' + referral().phone">{{ referral().phone }}</a>
          </p>
          <p class="hint">You reached out {{ outreach.sentAt | date: 'MMM d, h:mm a' }}.</p>
        </section>
      } @else {
        <section class="contact hidden">
          <h3>Contact details</h3>
          <p class="hint">
            {{ referral().firstName }}'s full name, email, and phone appear after you send Outreach.
          </p>
        </section>
      }
    }
  `,
  styles: `
    .facts {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(12rem, 1fr));
      gap: var(--space-xs) var(--space-m);
      margin: 0;
    }
    .facts .wide {
      grid-column: 1 / -1;
    }
    dt {
      color: var(--color-ink-soft);
      font-size: var(--step--2);
      text-transform: uppercase;
      letter-spacing: 0.04em;
    }
    dd {
      margin: 0;
    }
    .contact {
      border-radius: var(--border-radius-md);
      padding: var(--space-xs) var(--space-s);
      margin-block-start: var(--space-s);
    }
    .contact h3 {
      margin: 0 0 var(--space-3xs);
      font-size: var(--step-0);
    }
    .contact p {
      margin: 0;
    }
    .hidden {
      background: var(--color-sand);
      border: 1px dashed var(--color-line-strong);
    }
    .revealed {
      background: var(--color-success-soft);
    }
    .hint {
      color: var(--color-ink-soft);
      font-size: var(--step--1);
    }
  `,
})
export class PrototypeRequestFacts {
  referral = input.required<PrototypeReferral>();
  showContact = input(true);
  protected due = dueLabel;
  protected services = servicesLabel;
}
