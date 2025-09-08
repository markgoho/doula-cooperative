import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private authService = inject(AuthService);

  protected readonly brandTitle = 'Doula Cooperative';

  protected readonly isAuthenticated = computed(() => this.authService.user() !== null);

  protected readonly isEmailVerified = computed(() => {
    return this.authService.user()?.emailVerified ?? false;
  });
}
