import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { AdminMembersStateService } from '../state/admin-members-state.service';
import { ActiveMembersTable } from '../users/active-members-table/active-members-table';

@Component({
  imports: [ActiveMembersTable],
  templateUrl: './admin-members.html',
  styleUrl: './admin-members.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminMembers {
  private membersState = inject(AdminMembersStateService);

  protected membersResource = this.membersState.membersResource;

  constructor() {
    this.membersState.initialize();
  }

  protected totalMembers = computed(() => {
    return this.membersResource.hasValue() ? (this.membersResource.value()?.total ?? 0) : 0;
  });

  protected membersWarning = computed(() => {
    return this.membersResource.hasValue() ? this.membersResource.value()?.warning : undefined;
  });
}
