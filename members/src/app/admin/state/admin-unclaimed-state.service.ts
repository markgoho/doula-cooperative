import { Injectable, inject, resource, signal } from '@angular/core';
import { AdminMembersService } from '../services/admin-members.service';

@Injectable({
  providedIn: 'root',
})
export class AdminUnclaimedStateService {
  private adminMembersService = inject(AdminMembersService);
  private initialized = signal(false);

  readonly unclaimedResource = resource({
    params: () => (this.initialized() ? {} : undefined),
    loader: () => this.adminMembersService.listUnclaimedProfiles(),
  });

  initialize(): void {
    this.initialized.set(true);
  }

  invalidate(): void {
    this.unclaimedResource.reload();
  }
}
