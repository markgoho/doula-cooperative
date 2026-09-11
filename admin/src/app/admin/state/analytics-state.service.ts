import { inject, resource, Service, signal } from '@angular/core';
import { AnalyticsService } from '../services/analytics.service';

@Service()
export class AnalyticsStateService {
  private readonly analyticsService = inject(AnalyticsService);
  private initialized = signal(false);

  readonly memberSignupsResource = resource({
    params: () => (this.initialized() ? {} : undefined),
    loader: () => this.analyticsService.getMemberSignups(),
  });

  readonly costOffsetRateResource = resource({
    params: () => (this.initialized() ? {} : undefined),
    loader: () => this.analyticsService.getCostOffsetRate(),
  });

  readonly matchRequestLocationsResource = resource({
    params: () => (this.initialized() ? {} : undefined),
    loader: () => this.analyticsService.getMatchRequestLocations(),
  });

  readonly topPagesResource = resource({
    params: () => (this.initialized() ? {} : undefined),
    loader: () => this.analyticsService.getTopPages(),
  });

  initialize(): void {
    this.initialized.set(true);
  }
}
