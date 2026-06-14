import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
} from '@angular/core';
import type { ResourceRef } from '@angular/core';
import type { MemberSignupsResponse } from '../../../api-types/analytics-api.types';

type SignupsResource = ResourceRef<MemberSignupsResponse | undefined>;

@Component({
  selector: 'app-signups-bar-chart',
  templateUrl: './signups-bar-chart.html',
  styleUrl: './signups-bar-chart.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SignupsBarChart {
  @Input({ required: true }) resource!: SignupsResource;

  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);
  protected readonly days = computed(() =>
    this.resource.isLoading() || this.resource.error() !== undefined
      ? []
      : (this.resource.value()?.days ?? []),
  );

  protected readonly maxCount = computed(() => {
    const counts = this.days().map((d) => d.count);
    return counts.length === 0 ? 1 : Math.max(...counts, 1);
  });

  protected barHeight(count: number): string {
    return `${Math.round((count / this.maxCount()) * 100)}%`;
  }

  protected formatDate(dateString: string): string {
    const parts = dateString.split('-');
    return parts[2] ?? dateString;
  }
}
