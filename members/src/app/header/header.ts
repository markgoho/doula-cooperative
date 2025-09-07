import { ChangeDetectionStrategy, Component, computed, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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

  // eslint-disable-next-line unicorn/no-null
  private userSignal = toSignal(this.authService.user$, { initialValue: null });

  protected readonly isAuthenticated = computed(() => this.userSignal() !== null);
}
