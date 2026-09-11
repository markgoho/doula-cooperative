import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AdminMatchRequestsStateService } from '../state/admin-match-requests-state.service';
import { MatchRequestsTable } from './match-requests-table/match-requests-table';

@Component({
  imports: [MatchRequestsTable],
  templateUrl: './admin-match-requests.html',
  styleUrl: './admin-match-requests.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMatchRequests {
  private matchRequestsState = inject(AdminMatchRequestsStateService);

  protected matchRequestsResource = this.matchRequestsState.matchRequestsResource;

  constructor() {
    this.matchRequestsState.initialize();
  }

  protected totalRequests = computed(() => {
    return this.matchRequestsResource.hasValue()
      ? (this.matchRequestsResource.value()?.total ?? 0)
      : 0;
  });

  protected pendingCount = computed(() => {
    return this.matchRequestsResource.hasValue()
      ? (this.matchRequestsResource.value()?.pendingCount ?? 0)
      : 0;
  });

  protected processedCount = computed(() => {
    return this.matchRequestsResource.hasValue()
      ? (this.matchRequestsResource.value()?.processedCount ?? 0)
      : 0;
  });
}
