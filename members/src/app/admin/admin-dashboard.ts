import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminMembersService } from './admin.service';

@Component({
  imports: [RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  private adminMembersService = inject(AdminMembersService);

  // Load stats for the dashboard cards
  protected membersResource = resource({
    loader: () => this.adminMembersService.listMembers(1, 0),
  });

  protected unclaimedResource = resource({
    loader: () => this.adminMembersService.listUnclaimedProfiles(1, 0),
  });

  protected totalMembers = computed(() => {
    return this.membersResource.hasValue() ? (this.membersResource.value()?.total ?? 0) : 0;
  });

  protected totalUnclaimed = computed(() => this.unclaimedResource.value()?.total ?? 0);
}
