import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminMatchRequestsStateService } from './state/admin-match-requests-state.service';
import { AdminMembersStateService } from './state/admin-members-state.service';
import { AdminMessagesStateService } from './state/admin-messages-state.service';
import { AdminUnclaimedStateService } from './state/admin-unclaimed-state.service';

@Component({
  imports: [RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  private membersState = inject(AdminMembersStateService);
  private unclaimedState = inject(AdminUnclaimedStateService);
  private matchRequestsState = inject(AdminMatchRequestsStateService);
  private messagesState = inject(AdminMessagesStateService);

  protected membersResource = this.membersState.membersResource;
  protected unclaimedResource = this.unclaimedState.unclaimedResource;
  protected matchRequestsResource = this.matchRequestsState.matchRequestsResource;
  protected messagesResource = this.messagesState.messagesResource;

  constructor() {
    this.membersState.initialize();
    this.unclaimedState.initialize();
    this.matchRequestsState.initialize();
    this.messagesState.initialize();
  }

  protected totalMembers = computed(() => {
    return this.membersResource.hasValue() ? (this.membersResource.value()?.total ?? 0) : 0;
  });

  protected totalUnclaimed = computed(() => this.unclaimedResource.value()?.total ?? 0);

  protected pendingMatchRequests = computed(() => {
    return this.matchRequestsResource.hasValue()
      ? (this.matchRequestsResource.value()?.pendingCount ?? 0)
      : 0;
  });

  protected pendingMessages = computed(() => {
    return this.messagesResource.hasValue()
      ? (this.messagesResource.value()?.pendingCount ?? 0)
      : 0;
  });
}
