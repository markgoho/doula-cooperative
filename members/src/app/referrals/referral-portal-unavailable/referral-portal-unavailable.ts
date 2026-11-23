import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * Friendly state shown on Referral Portal pages while the Referral Portal v2
 * switch is off for this member.
 */
@Component({
  selector: 'app-referral-portal-unavailable',
  imports: [RouterLink],
  template: `
    <section class="unavailable" aria-labelledby="referral-portal-unavailable-heading">
      <h2 id="referral-portal-unavailable-heading">Referrals aren't available yet</h2>
      <p>We're getting a new referral portal ready. Check back soon.</p>
      <a routerLink="/membership">Back to your membership</a>
    </section>
  `,
  styles: `
    .unavailable {
      background: var(--color-surface);
      border: 1px solid var(--color-line);
      border-radius: var(--border-radius-md);
      padding: var(--space-l);
      text-align: center;
    }

    h2 {
      margin-block: 0 var(--space-2xs);
    }

    p {
      color: var(--color-ink-soft);
      margin-block: 0 var(--space-s);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralPortalUnavailable {}
