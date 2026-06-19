import { inject, resource, Service, signal } from '@angular/core';
import { AdminMatchRequestsService } from '../services/admin-match-requests.service';

@Service()
export class AdminMatchRequestsStateService {
  private adminMatchRequestsService = inject(AdminMatchRequestsService);
  private initialized = signal(false);

  readonly matchRequestsResource = resource({
    params: () => (this.initialized() ? {} : undefined),
    loader: () => this.adminMatchRequestsService.listMatchRequests(100, 0, 'all'),
  });

  initialize(): void {
    this.initialized.set(true);
  }

  invalidate(): void {
    this.matchRequestsResource.reload();
  }
}
