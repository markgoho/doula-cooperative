import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { AdminMatchRequestsService } from '../services/admin-match-requests.service';
import { MatchRequestsTable } from './match-requests-table/match-requests-table';

@Component({
  imports: [MatchRequestsTable],
  templateUrl: './admin-match-requests.html',
  styleUrl: './admin-match-requests.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMatchRequests {
  private adminMatchRequestsService = inject(AdminMatchRequestsService);

  protected matchRequestsResource = resource({
    loader: () => this.adminMatchRequestsService.listMatchRequests(100, 0, 'all'),
  });

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
