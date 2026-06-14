import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
} from '@angular/core';
import type { ResourceRef } from '@angular/core';
import type { CostOffsetRateResponse } from '../../../api-types/analytics-api.types';

type CostOffsetResource = ResourceRef<CostOffsetRateResponse | undefined>;

@Component({
  selector: 'app-cost-offset-stat-card',
  templateUrl: './cost-offset-stat-card.html',
  styleUrl: './cost-offset-stat-card.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CostOffsetStatCard {
  @Input({ required: true }) resource!: CostOffsetResource;

  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);
  protected readonly data = computed(() =>
    this.resource.isLoading() || this.resource.error() !== undefined
      ? undefined
      : this.resource.value(),
  );

  protected readonly pct = computed(() => {
    const d = this.data();
    if (!d || d.total === 0) return '0';
    return Math.round(d.rate * 100).toString();
  });
}
