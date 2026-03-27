import { Injectable, inject, resource, signal } from '@angular/core';
import { AdminMembersService } from '../services/admin-members.service';

@Injectable({
  providedIn: 'root',
})
export class AdminMembersStateService {
  private adminMembersService = inject(AdminMembersService);
  private initialized = signal(false);

  readonly membersResource = resource({
    params: () => (this.initialized() ? {} : undefined),
    loader: () => this.adminMembersService.listMembers(),
  });

  initialize(): void {
    this.initialized.set(true);
  }

  invalidate(): void {
    this.membersResource.reload();
  }
}
