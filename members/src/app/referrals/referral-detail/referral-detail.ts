import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  input,
  resource,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { SERVICE_LABELS_LONG } from '../../admin/match-requests/match-request.constants';
import { isValidDueDate, parseDueDate } from '../../admin/match-requests/match-request.utilities';
import {
  ReferralsService,
  type ReferralDetail as ReferralDetailModel,
} from '../../services/referrals.service';
import { Tag } from '../../tag/tag';

@Component({
  selector: 'app-referral-detail',
  imports: [DatePipe, RouterLink, Tag],
  templateUrl: './referral-detail.html',
  styleUrl: './referral-detail.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralDetail {
  private referralsService = inject(ReferralsService);

  // Route parameter binding via withComponentInputBinding
  id = input.required<string>();

  protected referralResource = resource({
    params: () => ({ id: this.id() }),
    loader: ({ params }) => this.referralsService.getReferral(params.id),
  });

  protected parsedDueDate = computed(() => {
    const referral = this.referralResource.value();
    if (!referral || !isValidDueDate(referral.estimatedDueDate)) return;
    return parseDueDate(referral.estimatedDueDate);
  });

  protected isDueSoon(referral: ReferralDetailModel): boolean {
    if (!isValidDueDate(referral.estimatedDueDate) || !referral.services.includes('birth-doula')) {
      return false;
    }

    const dueDate = parseDueDate(referral.estimatedDueDate);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntilDue = (dueDate.getTime() - today.getTime()) / (24 * 60 * 60 * 1000);
    return daysUntilDue >= 0 && daysUntilDue <= 30;
  }

  protected getServiceLabel(service: string): string {
    return SERVICE_LABELS_LONG[service] ?? service;
  }
}
