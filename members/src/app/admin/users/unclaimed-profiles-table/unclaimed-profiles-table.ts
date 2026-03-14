import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  type ResourceRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tag } from '../../../tag/tag';
import type { ListUnclaimedProfilesResponse } from '../../admin.types';
import { createTableSortState } from '../../../shared/create-table-sort-state';
import { SortableHeader } from '../../../shared/sortable-header/sortable-header';

type UnclaimedProfileSortColumn =
  | 'name'
  | 'email'
  | 'hasProfile'
  | 'subscriptionStart'
  | 'lastPayment'
  | 'nextPayment';

@Component({
  selector: 'app-unclaimed-profiles-table',
  imports: [RouterLink, DatePipe, Tag, SortableHeader],
  templateUrl: './unclaimed-profiles-table.html',
  styleUrl: '../admin-table-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class UnclaimedProfilesTable {
  profilesResource = input.required<ResourceRef<ListUnclaimedProfilesResponse | undefined>>();

  protected sortState = createTableSortState<UnclaimedProfileSortColumn>({
    defaultColumn: 'subscriptionStart',
    defaultDirection: 'desc',
  });
  protected sortColumn = this.sortState.sortColumn;
  protected sortDirection = this.sortState.sortDirection;
  protected handleSort = this.sortState.handleSort;

  protected error = computed(() => {
    const error = this.profilesResource().error();
    return error ? 'Failed to load unclaimed profiles. Please try again.' : undefined;
  });

  protected sortedProfiles = computed(() => {
    const resource = this.profilesResource();
    if (!resource.hasValue()) return [];

    const data = [...(resource.value()?.profiles ?? [])];
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
          comparison = a.subscriptionStart.getTime() - b.subscriptionStart.getTime();
          break;
        }
        case 'lastPayment': {
          const aMilliseconds = a.lastPayment?.getTime() ?? 0;
          const bMilliseconds = b.lastPayment?.getTime() ?? 0;
          comparison = aMilliseconds - bMilliseconds;
          break;
        }
        case 'nextPayment': {
          const aMilliseconds = a.nextPayment?.getTime() ?? 0;
          const bMilliseconds = b.nextPayment?.getTime() ?? 0;
          comparison = aMilliseconds - bMilliseconds;
          break;
        }
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  });
}
