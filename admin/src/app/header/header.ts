import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { RouterLink, RouterLinkActive } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-header',
  imports: [RouterLink, RouterLinkActive],
  templateUrl: './header.html',
  styleUrls: ['./header.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  private authService = inject(AuthService);

  readonly brandTitle = 'Doula Cooperative Admin';
  readonly isAuthenticated = computed(() => this.authService.isAuthenticated);
  readonly isAdmin = this.authService.isAdmin;

  async signOut(): Promise<void> {
    await this.authService.signOut();
  }
}
