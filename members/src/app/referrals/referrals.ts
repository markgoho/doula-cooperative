import { ChangeDetectionStrategy, Component, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tag } from '../tag/tag';
import { SERVICE_LABELS } from '../admin/match-requests/match-request.constants';
import {
  getRelativeTime,
  isValidDueDate,
  parseDueDate,
} from '../admin/match-requests/match-request.utilities';
import { ReferralsService, type ReferralListItem } from '../services/referrals.service';

@Component({
  imports: [RouterLink, Tag],
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
    if (!isValidDueDate(item.estimatedDueDate)) return '';
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    }).format(parseDueDate(item.estimatedDueDate));
  }

  protected hasDueDate(item: ReferralListItem): boolean {
    return isValidDueDate(item.estimatedDueDate);
  }

  protected isDueSoon(item: ReferralListItem): boolean {
    if (!this.hasDueDate(item) || !item.services.includes('birth-doula')) return false;

    const dueDate = parseDueDate(item.estimatedDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilDue = (dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
    return daysUntilDue >= 0 && daysUntilDue <= 30;
  }

  protected hasServices(item: ReferralListItem): boolean {
    return item.services.length > 0;
  }

  protected getFallbackHeading(item: ReferralListItem): string {
    return item.birthLocation || 'Referral request';
  }

  protected getRelativeTime(submitted: string): string {
    return getRelativeTime(submitted);
  }

  protected getServiceLabel(service: string): string {
    return SERVICE_LABELS[service] ?? service;
  }
}
