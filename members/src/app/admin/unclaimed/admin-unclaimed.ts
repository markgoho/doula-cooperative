import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
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

  protected refreshing = signal(false);
  protected refreshResult = signal('');

  protected async refreshPaymentDates(): Promise<void> {
    this.refreshing.set(true);
    this.refreshResult.set('');

    try {
      const result = await this.adminMembersService.refreshPaymentDates();
      this.refreshResult.set(`Updated ${result.updatedCount} of ${result.totalCount} profiles`);
      this.unclaimedResource.reload();
    } catch {
      this.refreshResult.set('Failed to refresh payment dates');
    } finally {
      this.refreshing.set(false);
    }
  }
}
