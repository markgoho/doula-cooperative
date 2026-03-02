import { signal, type WritableSignal } from '@angular/core';

type SortDirection = 'asc' | 'desc';

interface TableSortState<TColumn extends string> {
  sortColumn: WritableSignal<TColumn>;
  sortDirection: WritableSignal<SortDirection>;
  handleSort: (column: TColumn) => void;
}

export function createTableSortState<TColumn extends string>(options: {
  defaultColumn: TColumn;
  defaultDirection: SortDirection;
}): TableSortState<TColumn> {
  const sortColumn = signal<TColumn>(options.defaultColumn);
  const sortDirection = signal<SortDirection>(options.defaultDirection);

  const handleSort = (column: TColumn): void => {
    if (sortColumn() === column) {
      sortDirection.set(sortDirection() === 'asc' ? 'desc' : 'asc');
    } else {
      sortColumn.set(column);
      sortDirection.set('asc');
    }
  };

  return { sortColumn, sortDirection, handleSort };
}
