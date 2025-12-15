import { ChangeDetectionStrategy, Component, computed, inject, resource } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminMembersService } from './services/admin-members.service';
import { AdminMatchRequestsService } from './services/admin-match-requests.service';
import { AdminMessagesService } from './services/admin-messages.service';

@Component({
  imports: [RouterLink],
  templateUrl: './admin-dashboard.html',
  styleUrl: './admin-dashboard.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminDashboard {
  private adminMembersService = inject(AdminMembersService);
  private adminMatchRequestsService = inject(AdminMatchRequestsService);
  private adminMessagesService = inject(AdminMessagesService);

  // Load stats for the dashboard cards
  protected membersResource = resource({
    loader: () => this.adminMembersService.listMembers(),
  });

  protected unclaimedResource = resource({
    loader: () => this.adminMembersService.listUnclaimedProfiles(),
  });

  protected matchRequestsResource = resource({
    loader: () => this.adminMatchRequestsService.listMatchRequests(),
  });

  protected messagesResource = resource({
    loader: () => this.adminMessagesService.listMessages(),
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

  protected pendingMessages = computed(() => {
    return this.messagesResource.hasValue()
      ? (this.messagesResource.value()?.pendingCount ?? 0)
      : 0;
  });
}
