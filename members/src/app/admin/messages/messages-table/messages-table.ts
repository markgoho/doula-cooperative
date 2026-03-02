import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  type ResourceRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import { Tag } from '../../../tag/tag';
import type { ListMessagesResponse } from '../../admin.types';
import { getRelativeTime } from '../../match-requests/match-request.utilities';
import { createTableSortState } from '../../../shared/create-table-sort-state';
import { SortableHeader } from '../../../shared/sortable-header/sortable-header';

type MessageSortColumn = 'name' | 'submitted';

@Component({
  selector: 'app-messages-table',
  imports: [RouterLink, Tag, SortableHeader],
  templateUrl: './messages-table.html',
  styleUrl: './messages-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagesTable {
  messagesResource = input.required<ResourceRef<ListMessagesResponse | undefined>>();

  protected sortState = createTableSortState<MessageSortColumn>({
    defaultColumn: 'submitted',
    defaultDirection: 'desc',
  });
  protected sortColumn = this.sortState.sortColumn;
  protected sortDirection = this.sortState.sortDirection;

  protected handleSort(column: string): void {
    this.sortState.handleSort(column as MessageSortColumn);
  }

  protected error = computed(() => {
    const error = this.messagesResource().error();
    return error ? 'Failed to load messages. Please try again.' : undefined;
  });

  protected sortedMessages = computed(() => {
    const resource = this.messagesResource();
    if (!resource.hasValue()) return [];

    const data = [...(resource.value()?.messages ?? [])];
    const column = this.sortColumn();
    const direction = this.sortDirection();

    return data.toSorted((a, b) => {
      let comparison = 0;

      switch (column) {
        case 'name': {
          const aName = a.contactName?.toLowerCase() || '';
          const bName = b.contactName?.toLowerCase() || '';
          comparison = aName.localeCompare(bName);
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

  protected getRelativeTime(dateString: string): string {
    return getRelativeTime(dateString);
  }
}
