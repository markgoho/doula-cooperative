import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, input, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tag } from '../../tag/tag';
import type { Member } from '../admin.service';

type SortDirection = 'asc' | 'desc';
type MemberSortColumn = 'name' | 'email' | 'membership' | 'created';

@Component({
  selector: 'app-active-members-table',
  imports: [RouterLink, DatePipe, Tag],
  templateUrl: './active-members-table.html',
  styleUrl: './admin-table-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveMembersTable {
  members = input.required<Member[]>();
  loading = input.required<boolean>();
  error = input<string | undefined>();

  protected sortColumn = signal<MemberSortColumn>('created');
  protected sortDirection = signal<SortDirection>('desc');

  protected sortedMembers = computed(() => {
    const data = [...this.members()];
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
        case 'email': {
          comparison = a.email.toLowerCase().localeCompare(b.email.toLowerCase());
          break;
        }
        case 'membership': {
          const aActive = a.membershipActive ?? false;
          const bActive = b.membershipActive ?? false;
          comparison = Number(bActive) - Number(aActive);
          break;
        }
        case 'created': {
          comparison = a.createdAt.toMillis() - b.createdAt.toMillis();
          break;
        }
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  });

  protected handleSort(column: MemberSortColumn): void {
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
