import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  templateUrl: './verify-email.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class VerifyEmail {
  private authService = inject(AuthService);
  private router = inject(Router);

  // Signal input automatically bound to the 'email' query parameter
  email = input<string>('');

  resendLoading = signal(false);
  errorMessage = signal('');
  successMessage = signal('');

  user = this.authService.user;

  constructor() {
    effect(() => {
      const currentUser = this.user();
      if (!currentUser) {
        void this.router.navigate(['/sign-up']);
      }
    });
  }

  async resendVerificationEmail() {
    this.resendLoading.set(true);
    this.errorMessage.set('');
    this.successMessage.set('');

    try {
      await this.authService.resendEmailVerification();
      this.successMessage.set('Verification email sent! Please check your inbox.');
    } catch {
      this.errorMessage.set('Failed to send verification email. Please try again.');
    } finally {
      this.resendLoading.set(false);
    }
  }

  async signOut() {
    await this.authService.signOut();
  }
}
