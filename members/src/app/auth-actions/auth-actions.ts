import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';

// Firebase Auth action modes
type AuthActionMode = 'verifyEmail' | 'resetPassword' | 'recoverEmail';

@Component({
  imports: [RouterLink, ReactiveFormsModule],
  templateUrl: './auth-actions.html',
  styleUrls: ['./auth-actions.scss'],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AuthActions {
  private authService = inject(AuthService);
  private membershipService = inject(MembershipService);
  private router = inject(Router);
  private fb = inject(FormBuilder);

  // Query params
  mode = input.required<AuthActionMode>();
  oobCode = input.required<string>();

  continueUrl = input<string>('');
  lang = input<string>('en');

  // UI state
  processingState = signal<'init' | 'verifying' | 'needsPassword' | 'success' | 'error'>('init');
  statusMessage = signal('');
  emailForAction = signal<string>('');

  // Reset password form (used when mode === 'resetPassword')
  resetForm = this.fb.group({
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]],
  });

  constructor() {
    effect(() => {
      const currentMode = this.mode();
      const code = this.oobCode();
      if (!code || this.processingState() !== 'init') {
        return;
      }
      void this.handleAction(currentMode, code);
    });
  }

  async handleAction(currentMode: AuthActionMode, code: string): Promise<void> {
    this.processingState.set('verifying');
    this.statusMessage.set('');

    try {
      switch (currentMode) {
        case 'verifyEmail': {
          await this.handleVerifyEmail(code);
          break;
        }
        case 'resetPassword': {
          await this.prepareResetPassword(code);
          break;
        }
        case 'recoverEmail': {
          await this.handleRecoverEmail(code);
          break;
        }
        default: {
          this.processingState.set('error');
          this.statusMessage.set('Invalid or unsupported action.');
        }
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'An unknown error occurred';
      this.processingState.set('error');
      this.statusMessage.set(message);
    }
  }

  private async handleVerifyEmail(code: string): Promise<void> {
    await this.authService.applyActionCode(code);
    await this.authService.reloadUser();

    // After applying the action code, navigate to the my membership page
    await this.router.navigate(['/membership']);
    this.processingState.set('success');
  }

  private async prepareResetPassword(code: string): Promise<void> {
    const email = await this.authService.verifyPasswordResetCode(code);
    this.emailForAction.set(email);
    this.processingState.set('needsPassword');
  }

  async submitNewPassword(): Promise<void> {
    if (this.processingState() !== 'needsPassword') return;
    if (this.resetForm.invalid) {
      this.resetForm.markAllAsTouched();
      return;
    }

    const { password, confirmPassword } = this.resetForm.getRawValue();
    if (!password || !confirmPassword || password !== confirmPassword) {
      this.statusMessage.set('Passwords do not match.');
      return;
    }

    const code = this.oobCode();
    if (!code) {
      this.processingState.set('error');
      this.statusMessage.set('Missing code for password reset.');
      return;
    }

    this.processingState.set('verifying');
    try {
      await this.authService.confirmPasswordReset(code, password);

      // Try to auto-sign-in and verify email
      const email = this.emailForAction();
      if (email !== '') {
        try {
          await this.authService.signInWithEmail(email, password);
          // Now authenticated - mark email as verified (best-effort)
          await this.membershipService.verifyEmail();
          // Navigate directly to membership dashboard
          this.processingState.set('success');
          this.statusMessage.set(
            'Password has been reset successfully. Welcome to your membership dashboard!',
          );
          await this.router.navigate(['/membership']);
          return;
        } catch {
          // Sign-in failed - fall back to redirect to sign-in page
        }
      }

      // Fallback: redirect to sign-in with email prefilled
      this.processingState.set('success');
      this.statusMessage.set('Password has been reset successfully. You can now sign in.');
      await this.router.navigate(
        ['/sign-in'],
        email !== '' ? { queryParams: { email } } : undefined,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password.';
      this.processingState.set('error');
      this.statusMessage.set(message);
    }
  }

  private async handleRecoverEmail(code: string): Promise<void> {
    // Get info first to retrieve the restored email, then apply the action.
    const info = await this.authService.checkActionCode(code);
    const restoredEmail = info.data.email as string | undefined;
    if (restoredEmail && restoredEmail !== '') {
      this.emailForAction.set(restoredEmail);
    }
    await this.authService.applyActionCode(code);

    if (restoredEmail && restoredEmail !== '') {
      // best-effort password reset recommendation
      void this.authService.sendPasswordResetEmail(restoredEmail);
    }

    this.processingState.set('success');
    this.statusMessage.set(
      'Your email has been restored. Please check your inbox to secure your account.',
    );

    // Respect continueUrl if provided
    const target = this.continueUrl();
    if (target) {
      globalThis.location.href = target;
      return;
    }
    await this.router.navigate(['/sign-in']);
  }
}
