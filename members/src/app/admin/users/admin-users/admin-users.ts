import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { AdminMembersService } from '../../services/admin-members.service';
import { ActiveMembersTable } from '../active-members-table/active-members-table';
import { UnclaimedProfilesTable } from '../unclaimed-profiles-table/unclaimed-profiles-table';

@Component({
  imports: [ActiveMembersTable, UnclaimedProfilesTable],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsers {
  private adminMembersService = inject(AdminMembersService);

  protected membersResource = resource({
    loader: () => this.adminMembersService.listMembers(),
  });

  protected totalMembers = computed(() => {
    return this.membersResource.hasValue() ? (this.membersResource.value()?.total ?? 0) : 0;
  });

  protected membersWarning = computed(() => {
    return this.membersResource.hasValue() ? this.membersResource.value()?.warning : undefined;
  });

  protected unclaimedResource = resource({
    loader: () => this.adminMembersService.listUnclaimedProfiles(),
  });

  protected totalUnclaimed = computed(() => this.unclaimedResource.value()?.total ?? 0);

  constructor() {
    // No manual loading needed
  }
}
