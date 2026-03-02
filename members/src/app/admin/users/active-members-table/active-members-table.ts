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
import type { ListMembersResponse } from '../../admin.types';
import { createTableSortState } from '../../../shared/create-table-sort-state';
import { SortableHeader } from '../../../shared/sortable-header/sortable-header';

type MemberSortColumn = 'name' | 'email' | 'membership' | 'created';

@Component({
  selector: 'app-active-members-table',
  imports: [RouterLink, DatePipe, Tag, SortableHeader],
  templateUrl: './active-members-table.html',
  styleUrl: '../admin-table-shared.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ActiveMembersTable {
  membersResource = input.required<ResourceRef<ListMembersResponse | undefined>>();

  protected sortState = createTableSortState<MemberSortColumn>({
    defaultColumn: 'created',
    defaultDirection: 'desc',
  });
  protected sortColumn = this.sortState.sortColumn;
  protected sortDirection = this.sortState.sortDirection;
  protected handleSort = this.sortState.handleSort;

  protected error = computed(() => {
    const error = this.membersResource().error();
    return error ? 'Failed to load members. Please try again.' : undefined;
  });

  protected sortedMembers = computed(() => {
    const resource = this.membersResource();
    if (!resource.hasValue()) return [];

    const data = [...(resource.value()?.members ?? [])];
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
          // ISO 8601 strings are lexicographically sortable
          comparison = a.createdAt.localeCompare(b.createdAt);
          break;
        }
      }

      return direction === 'asc' ? comparison : -comparison;
    });
  });
}
