import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { AdminMembersService, type UnclaimedProfile } from '../../admin.service';
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
    loader: () => this.adminMembersService.listMembers(100, 0),
  });

  protected totalMembers = computed(() => {
    return this.membersResource.hasValue() ? (this.membersResource.value()?.total ?? 0) : 0;
  });

  protected unclaimedProfiles = signal<UnclaimedProfile[]>([]);
  protected unclaimedTotal = signal(0);
  protected unclaimedLoading = signal(true);
  protected unclaimedError = signal<string | undefined>(undefined);

  constructor() {
    void this.loadUnclaimedProfiles();
  }

  private async loadUnclaimedProfiles(): Promise<void> {
    this.unclaimedLoading.set(true);
    this.unclaimedError.set(undefined);

    try {
      const response = await this.adminMembersService.listUnclaimedProfiles(100, 0);
      this.unclaimedProfiles.set(response.profiles);
      this.unclaimedTotal.set(response.total);
    } catch (error) {
      console.error('Error loading unclaimed profiles:', error);
      this.unclaimedError.set('Failed to load unclaimed profiles. Please try again.');
    } finally {
      this.unclaimedLoading.set(false);
    }
  }
}
