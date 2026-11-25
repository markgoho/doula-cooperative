import { inject, Service, signal } from '@angular/core';
import { ReferralsService } from '../services/referrals.service';
import type { ReferralDetail } from './referral.types';

/**
 * Referral details already fetched on the inbox page, so switching between
 * Referrals shows them at once while a fresh copy loads in the background.
 * Provided by the inbox page, never at root: entries hold this viewer's
 * revealed contact details and are dropped with the page.
 */
@Service({ autoProvided: false })
export class ReferralDetailCache {
  private referralsService = inject(ReferralsService);
  private entries = signal<ReadonlyMap<string, ReferralDetail>>(new Map());
  private inFlight = new Map<string, Promise<ReferralDetail>>();
  /** Bumped by each change made on the page, so an older fetch can't undo it. */
  private writes = new Map<string, number>();

  get(id: string): ReferralDetail | undefined {
    return this.entries().get(id);
  }

  /** Store a change made on the page, such as sent Outreach or a saved Outcome. */
  set(id: string, detail: ReferralDetail): void {
    this.writes.set(id, (this.writes.get(id) ?? 0) + 1);
    this.store(id, detail);
  }

  /** Fetch a fresh copy and cache it. Concurrent calls for one Referral share a request. */
  load(id: string): Promise<ReferralDetail> {
    const pending = this.inFlight.get(id);
    if (pending) return pending;
    const request = this.fetch(id);
    this.inFlight.set(id, request);
    return request;
  }

  /** Warm the cache ahead of a click. Failures surface when the Referral is opened. */
  async prefetch(id: string): Promise<void> {
    if (this.entries().has(id) || this.inFlight.has(id)) return;
    try {
      await this.load(id);
    } catch {
      // Opening the Referral fetches it again and shows the error.
    }
  }

  private async fetch(id: string): Promise<ReferralDetail> {
    const writesAtStart = this.writes.get(id);
    try {
      const detail = await this.referralsService.getReferral(id);
      // A change made on the page since this fetch started wins.
      if (this.writes.get(id) !== writesAtStart) return this.get(id) ?? detail;
      this.store(id, detail);
      return detail;
    } finally {
      this.inFlight.delete(id);
    }
  }

  /** Keep the cached object when nothing changed, so the pane isn't disturbed. */
  private store(id: string, detail: ReferralDetail): void {
    const cached = this.entries().get(id);
    if (cached && JSON.stringify(cached) === JSON.stringify(detail)) return;
    this.entries.update((entries) => new Map(entries).set(id, detail));
  }
}
