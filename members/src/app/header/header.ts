import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private authService = inject(AuthService);
  private membershipService = inject(MembershipService);

  protected readonly brandTitle = 'Doula Cooperative';

  protected readonly isAuthenticated = computed(() => this.authService.user() !== null);

  protected readonly isEmailVerified = computed(() => {
    return this.authService.user()?.emailVerified ?? false;
  });

  protected readonly canEditProfile = computed(() => {
    return this.isEmailVerified() && this.membershipService.membershipActive();
  });

  protected readonly hasProfile = computed(() => {
    const user = this.membershipService.userDocument();
    // New users: profileCreatedAt exists
    // Migrated users: profileCreatedAt from createdAt
    // Existing users without migration: fallback to slug
    return !!(user?.profileCreatedAt ?? user?.slug);
  });

  protected readonly isAdmin = this.authService.isAdmin;
}
