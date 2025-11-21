import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tag } from '../../../tag/tag';
import type { UnclaimedProfile } from '../../admin.service';

type SortDirection = 'asc' | 'desc';
type UnclaimedProfileSortColumn =
  | 'name'
  | 'email'
  | 'hasProfile'
  | 'subscriptionStart'
  | 'lastPayment'
  | 'nextPayment';

@Component({
  selector: 'app-unclaimed-profiles-table',
  imports: [RouterLink, DatePipe, Tag],
  templateUrl: './unclaimed-profiles-table.html',
  styleUrl: '../admin-table-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnclaimedProfilesTable {
  profiles = input.required<UnclaimedProfile[]>();
  loading = input.required<boolean>();
  error = input<string | undefined>();

  protected sortColumn = signal<UnclaimedProfileSortColumn>('subscriptionStart');
  protected sortDirection = signal<SortDirection>('desc');

  protected sortedProfiles = computed(() => {
    const data = [...this.profiles()];
    const column = this.sortColumn();
    const direction = this.sortDirection();

    return data.toSorted((a, b) => {
      let comparison = 0;

      switch (column) {
        case 'name': {
          comparison = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          break;
        }
        case 'email': {
          comparison = a.email.toLowerCase().localeCompare(b.email.toLowerCase());
          break;
        }
        case 'hasProfile': {
          const aHasProfile = !!a.slug;
          const bHasProfile = !!b.slug;
          comparison = Number(bHasProfile) - Number(aHasProfile);
          break;
        }
        case 'subscriptionStart': {
          comparison = a.subscriptionStart.toMillis() - b.subscriptionStart.toMillis();
          break;
        }
        case 'lastPayment': {
          const aMillis = a.lastPayment?.toMillis() ?? 0;
          const bMillis = b.lastPayment?.toMillis() ?? 0;
          comparison = aMillis - bMillis;
          break;
        }
        case 'nextPayment': {
          const aMillis = a.nextPayment?.toMillis() ?? 0;
          const bMillis = b.nextPayment?.toMillis() ?? 0;
          comparison = aMillis - bMillis;
          break;
        }
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  });

  protected handleSort(column: UnclaimedProfileSortColumn): void {
    if (this.sortColumn() === column) {
      // Toggle direction if clicking the same column
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }
}
