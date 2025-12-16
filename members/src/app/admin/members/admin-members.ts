import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { AdminMembersService } from '../services/admin-members.service';
import { ActiveMembersTable } from '../users/active-members-table/active-members-table';

@Component({
  imports: [ActiveMembersTable],
  templateUrl: './admin-members.html',
  styleUrl: './admin-members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMembers {
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
}
