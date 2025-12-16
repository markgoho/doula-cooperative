import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { AdminMembersService } from '../services/admin-members.service';
import { UnclaimedProfilesTable } from '../users/unclaimed-profiles-table/unclaimed-profiles-table';

@Component({
  imports: [UnclaimedProfilesTable],
  templateUrl: './admin-unclaimed.html',
  styleUrl: './admin-unclaimed.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUnclaimed {
  private adminMembersService = inject(AdminMembersService);

  protected unclaimedResource = resource({
    loader: () => this.adminMembersService.listUnclaimedProfiles(),
  });

  protected totalUnclaimed = computed(() => this.unclaimedResource.value()?.total ?? 0);
}
