import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { SERVICE_LABELS } from '../admin/match-requests/match-request.constants';
import {
  getRelativeTime,
  isValidDueDate,
  parseDueDate,
} from '../admin/match-requests/match-request.utilities';
import { ReferralsService, type ReferralListItem } from '../services/referrals.service';

@Component({
  imports: [RouterLink],
  templateUrl: './referrals.html',
  styleUrl: './referrals.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Referrals {
  private referralsService = inject(ReferralsService);

  protected referralsResource = resource({
    loader: () => this.referralsService.listReferrals(),
  });

  protected formatDueDate(item: ReferralListItem): string {
    if (!isValidDueDate(item.estimatedDueDate)) return '—';
    return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      .format(parseDueDate(item.estimatedDueDate));
  }

  protected getRelativeTime(submitted: string): string {
    return getRelativeTime(submitted);
  }

  protected getServiceLabel(service: string): string {
    return SERVICE_LABELS[service] ?? service;
  }
}
