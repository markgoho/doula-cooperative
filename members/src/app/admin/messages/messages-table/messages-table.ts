import {
  ChangeDetectionStrategy,
  Component,
  computed,
  input,
  signal,
  type ResourceRef,
} from '@angular/core';
import { RouterLink } from '@angular/router';
import type { ListMessagesResponse } from '../../admin.types';
import { getRelativeTime } from '../../match-requests/match-request.utilities';

type SortDirection = 'asc' | 'desc';
type MessageSortColumn = 'name' | 'submitted';

@Component({
  selector: 'app-messages-table',
  imports: [RouterLink],
  templateUrl: './messages-table.html',
  styleUrl: './messages-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MessagesTable {
  messagesResource = input.required<ResourceRef<ListMessagesResponse | undefined>>();

  protected sortColumn = signal<MessageSortColumn>('submitted');
  protected sortDirection = signal<SortDirection>('desc');

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

  protected handleSort(column: MessageSortColumn): void {
    if (this.sortColumn() === column) {
      // Toggle direction if clicking the same column
      this.sortDirection.set(this.sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      // Set new column and default to ascending
      this.sortColumn.set(column);
      this.sortDirection.set('asc');
    }
  }

  protected getRelativeTime(dateString: string): string {
    return getRelativeTime(dateString);
  }
}
