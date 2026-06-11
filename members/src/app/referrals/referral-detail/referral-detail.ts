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
import {
  isValidDueDate,
  parseDueDate,
} from '../../admin/match-requests/match-request.utilities';
import { ReferralsService } from '../../services/referrals.service';

@Component({
  selector: 'app-referral-detail',
  imports: [DatePipe, RouterLink],
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

  protected getServiceLabel(service: string): string {
    return SERVICE_LABELS_LONG[service] ?? service;
  }
}
