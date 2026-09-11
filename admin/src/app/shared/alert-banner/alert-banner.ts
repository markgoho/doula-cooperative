import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';

export type AlertVariant = 'success' | 'error' | 'warning' | 'info';

const ROLE_MAP: Record<AlertVariant, string | undefined> = {
  error: 'alert',
  success: 'status',
  warning: undefined,
  info: undefined,
};

@Component({
  selector: 'app-alert-banner',
  template: '<ng-content />',
  styleUrl: './alert-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'variant()',
    '[attr.role]': 'role()',
  },
})
export class AlertBanner {
  variant = input<AlertVariant>('info');
  protected role = computed(() => ROLE_MAP[this.variant()]);
}
