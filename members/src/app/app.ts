import { AsyncPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { Footer } from './footer/footer';
import { Header } from './header/header';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, Header, Footer, AsyncPipe],
  templateUrl: './app.html',
  styleUrl: './app.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class App {
  protected readonly title = signal('members');
  protected authService = inject(AuthService);

  protected showVerificationBanner = computed(() => {
    const user = this.authService.user();
    return user && !user.emailVerified;
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

  protected idToken$ = this.authService.idToken$;
}
