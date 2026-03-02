import { ChangeDetectionStrategy, Component, input } from '@angular/core';

type AlertVariant = 'success' | 'error' | 'warning' | 'info';

@Component({
  selector: 'app-alert-banner',
  template: '<ng-content />',
  styleUrl: './alert-banner.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: {
    '[class]': 'variant()',
    '[attr.role]': "variant() === 'error' ? 'alert' : 'status'",
  },
})
export class AlertBanner {
  variant = input<AlertVariant>('info');
}
