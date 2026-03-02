import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';

type SortDirection = 'asc' | 'desc';

@Component({
  selector: 'th[app-sortable-header]',
  template: `<ng-content />
    @if (isActive()) {
      <span class="sort-indicator">{{ direction() === 'asc' ? '↑' : '↓' }}</span>
    }`,
  styleUrl: './sortable-header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    class: 'sortable',
    '(click)': 'sort.emit(column())',
  },
})
export class SortableHeader {
  column = input.required<string>({ alias: 'app-sortable-header' });
  activeColumn = input.required<string>();
  direction = input.required<SortDirection>();
  sort = output<string>();

  protected isActive = computed(() => this.activeColumn() === this.column());
}
