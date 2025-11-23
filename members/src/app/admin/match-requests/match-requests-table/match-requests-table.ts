import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  type ResourceRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tag } from '../../../tag/tag';
import type { ListMatchRequestsResponse } from '../../admin.service';
import { SERVICE_LABELS } from '../match-request.constants';
import {
  getRelativeTime,
  isValidDueDate,
  parseDueDate,
  type DueDate,
} from '../match-request.utilities';

type SortDirection = 'asc' | 'desc';
type MatchRequestSortColumn = 'name' | 'dueDate' | 'submitted';

@Component({
  selector: 'app-match-requests-table',
  imports: [RouterLink, Tag],
  templateUrl: './match-requests-table.html',
  styleUrl: './match-requests-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchRequestsTable {
  requestsResource = input.required<ResourceRef<ListMatchRequestsResponse | undefined>>();

  protected sortColumn = signal<MatchRequestSortColumn>('submitted');
  protected sortDirection = signal<SortDirection>('desc');

  protected error = computed(() => {
    const error = this.requestsResource().error();
    return error ? 'Failed to load match requests. Please try again.' : undefined;
  });

  protected sortedRequests = computed(() => {
    const resource = this.requestsResource();
    if (!resource.hasValue()) return [];

    const data = [...(resource.value()?.requests ?? [])];
    const column = this.sortColumn();
    const direction = this.sortDirection();

    return data.toSorted((a, b) => {
      let comparison = 0;

      switch (column) {
        case 'name': {
          const aName = a.name?.toLowerCase() || '';
          const bName = b.name?.toLowerCase() || '';
          comparison = aName.localeCompare(bName);
          break;
        }
        case 'dueDate': {
          const aValid = isValidDueDate(a.estimatedDueDate);
          const bValid = isValidDueDate(b.estimatedDueDate);

          // Put invalid dates at the end
          if (aValid && bValid) {
            const aDate = parseDueDate(a.estimatedDueDate);
            const bDate = parseDueDate(b.estimatedDueDate);
            comparison = aDate.getTime() - bDate.getTime();
          } else if (aValid && !bValid) {
            comparison = -1;
          } else if (!aValid && bValid) {
            comparison = 1;
          } else {
            comparison = 0;
          }
          break;
        }
        case 'submitted': {
          comparison = new Date(a.submitted).getTime() - new Date(b.submitted).getTime();
          break;
        }
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  });

  protected handleSort(column: MatchRequestSortColumn): void {
    if (this.sortColumn() === column) {
      // Toggle direction if clicking the same column
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  protected formatDueDate(dueDate: DueDate): string {
    if (!isValidDueDate(dueDate)) {
      return '—';
    }
    const date = parseDueDate(dueDate);
    return new DatePipe('en-US').transform(date, 'MMM d, yyyy') ?? '—';
  }

  protected getRelativeTime(dateString: string): string {
    return getRelativeTime(dateString);
  }

  protected getServiceLabel(service: string): string {
    return SERVICE_LABELS[service] ?? service;
  }

  protected getVisibleServices(services: string[]): string[] {
    return services.slice(0, 3);
  }

  protected getRemainingCount(services: string[]): number {
    return Math.max(0, services.length - 3);
  }
}
