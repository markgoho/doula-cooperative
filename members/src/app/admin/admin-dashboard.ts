import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminMembersService, AdminMatchRequestsService } from './admin.service';

@Component({
  imports: [RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  private adminMembersService = inject(AdminMembersService);
  private adminMatchRequestsService = inject(AdminMatchRequestsService);

  // Load stats for the dashboard cards
  protected membersResource = resource({
    loader: () => this.adminMembersService.listMembers(1, 0),
  });

  protected unclaimedResource = resource({
    loader: () => this.adminMembersService.listUnclaimedProfiles(1, 0),
  });

  protected matchRequestsResource = resource({
    loader: () => this.adminMatchRequestsService.listMatchRequests(1, 0, 'all'),
  });

  protected totalMembers = computed(() => {
    return this.membersResource.hasValue() ? (this.membersResource.value()?.total ?? 0) : 0;
  });

  protected totalUnclaimed = computed(() => this.unclaimedResource.value()?.total ?? 0);

  protected pendingMatchRequests = computed(() => {
    return this.matchRequestsResource.hasValue()
      ? (this.matchRequestsResource.value()?.pendingCount ?? 0)
      : 0;
  });
}
