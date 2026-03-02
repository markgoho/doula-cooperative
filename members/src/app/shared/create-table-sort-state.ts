import { type Signal, signal } from '@angular/core';

export type SortDirection = 'asc' | 'desc';

export interface TableSortState<TColumn extends string> {
  sortColumn: Signal<TColumn>;
  sortDirection: Signal<SortDirection>;
  handleSort: (column: string) => void;
}

export function createTableSortState<TColumn extends string>(options: {
  defaultColumn: TColumn;
  defaultDirection: SortDirection;
}): TableSortState<TColumn> {
  const sortColumn = signal<TColumn>(options.defaultColumn);
  const sortDirection = signal<SortDirection>(options.defaultDirection);

  function handleSort(column: string): void {
    if (sortColumn() === column) {
      sortDirection.set(sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      sortColumn.set(column as TColumn);
      sortDirection.set('asc');
    }
  }

  return { sortColumn, sortDirection, handleSort };
}
