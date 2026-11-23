import { Service, signal } from '@angular/core';

/**
 * Lets the Referral pane tell the inbox list to reload after a change
 * (such as sent Outreach) so the row's state and counts stay current.
 */
@Service()
export class ReferralListRefresh {
  private readonly versionSignal = signal(0);

  /** Bumps whenever the list should reload. */
  readonly version = this.versionSignal.asReadonly();

  request(): void {
    this.versionSignal.update((version) => version + 1);
  }
}
