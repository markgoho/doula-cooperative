import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { AdminMembersService, type Member } from '../admin.service';

@Component({
  imports: [RouterLink, DatePipe],
  templateUrl: './admin-users.html',
  styleUrl: './admin-users.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AdminUsers {
  private adminMembersService = inject(AdminMembersService);

  protected members = signal<Member[]>([]);
  protected total = signal(0);
  protected loading = signal(true);
  protected error = signal<string | undefined>(undefined);

  constructor() {
    void this.loadMembers();
  }

  private async loadMembers(): Promise<void> {
    this.loading.set(true);
    this.error.set(undefined);

    try {
      const response = await this.adminMembersService.listMembers(100, 0);
      this.members.set(response.members);
      this.total.set(response.total);
    } catch (error) {
      console.error('Error loading members:', error);
      this.error.set('Failed to load members. Please try again.');
    } finally {
      this.loading.set(false);
    }
  }
}
