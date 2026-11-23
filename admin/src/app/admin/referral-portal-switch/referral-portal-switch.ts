import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { AdminSettingsService } from '../services/admin-settings.service';

/**
 * Dashboard card with the Referral Portal v2 rollout switch.
 * While off, only Admins can reach the member Referral Portal.
 */
@Component({
  selector: 'app-referral-portal-switch',
  imports: [DatePipe],
  templateUrl: './referral-portal-switch.html',
  styleUrl: './referral-portal-switch.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ReferralPortalSwitch {
  private settingsService = inject(AdminSettingsService);

  protected settingsResource = resource({
    loader: () => this.settingsService.getReferralPortalSettings(),
  });

  protected isSaving = signal(false);
  protected saveError = signal<string | undefined>(undefined);

  protected isEnabled = computed(() => {
    return this.settingsResource.hasValue() && this.settingsResource.value().v2Enabled;
  });

  protected updatedAt = computed(() => {
    return this.settingsResource.hasValue() ? this.settingsResource.value().updatedAt : undefined;
  });

  protected async onToggle() {
    if (!this.settingsResource.hasValue() || this.isSaving()) return;

    this.isSaving.set(true);
    this.saveError.set(undefined);
    try {
      const updated = await this.settingsService.updateReferralPortalSettings(!this.isEnabled());
      this.settingsResource.set(updated);
    } catch (error) {
      console.error('Failed to update Referral Portal v2 switch', error);
      this.saveError.set('Could not save the switch. Please try again.');
    } finally {
      this.isSaving.set(false);
    }
  }
}
