import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterLink } from '@angular/router';

/**
 * State shown on the Referral Portal when the API answers 403 for a lapsed
 * membership.
 */
@Component({
  selector: 'app-referral-membership-required',
  imports: [RouterLink],
  template: `
    <section class="membership-required" aria-labelledby="membership-required-heading">
      <h2 id="membership-required-heading">Active membership required</h2>
      <p>Referrals are available to members with an active membership.</p>
      <a routerLink="/membership">Go to your membership</a>
    </section>
  `,
  styles: `
    .membership-required {
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
export class ReferralMembershipRequired {}
