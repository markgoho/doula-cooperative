import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from './footer/footer';
import { Header } from './header/header';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('members');
  protected authService = inject(AuthService);

  protected showVerificationBanner = computed(() => {
    const user = this.authService.user();
    if (!user) return false;
    // Use emailVerified signal so this recomputes when idToken changes
    return !this.authService.emailVerified();
  });

  protected async resendVerificationEmail(): Promise<void> {
    try {
      await this.authService.resendEmailVerification();
      // Optionally, provide feedback to the user that the email has been sent.
      console.log('Verification email resent successfully.');
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      // Optionally, show an error message to the user.
    }
  }
}
