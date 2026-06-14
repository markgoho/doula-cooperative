import {
  ChangeDetectionStrategy,
  Component,
  Input,
  computed,
} from '@angular/core';
import type { ResourceRef } from '@angular/core';
import type { TopPagesResponse } from '../../../api-types/analytics-api.types';

type TopPagesResource = ResourceRef<TopPagesResponse | undefined>;

@Component({
  selector: 'app-top-pages-list',
  templateUrl: './top-pages-list.html',
  styleUrl: './top-pages-list.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TopPagesList {
  @Input({ required: true }) resource!: TopPagesResource;

  protected readonly isLoading = computed(() => this.resource.isLoading());
  protected readonly hasError = computed(() => this.resource.error() !== undefined);
  protected readonly pages = computed(() =>
    this.resource.isLoading() || this.resource.error() !== undefined
      ? []
      : (this.resource.value()?.pages ?? []),
  );
}
