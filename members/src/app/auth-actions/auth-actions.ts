import { ChangeDetectionStrategy, Component, effect, inject, input, signal } from '@angular/core';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';

// Firebase Auth action modes
type AuthActionMode = 'verifyAndChangeEmail' | 'verifyEmail' | 'resetPassword' | 'recoverEmail';

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
        case 'verifyAndChangeEmail': {
          await this.handleVerifyEmail(code, true);
          break;
        }
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

  private async handleVerifyEmail(code: string, shouldSyncMemberEmail = false): Promise<void> {
    await this.authService.applyActionCode(code);
    await this.authService.reloadUser();

    if (shouldSyncMemberEmail) {
      await this.router.navigate(['/sign-in'], {
        queryParams: {
          emailChanged: 'true',
          message: 'Your email was updated. Please sign in again with your new email.',
        },
      });
      this.processingState.set('success');
      return;
    }

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

      const email = this.emailForAction();
      const signedIn = await this.attemptAutoSignIn(email, password);

      if (signedIn) {
        this.processingState.set('success');
        this.statusMessage.set(
          'Password has been reset successfully. Welcome to your membership dashboard!',
        );
        await this.router.navigate(['/membership']);
        return;
      }

      // Fallback: redirect to sign-in with email prefilled
      this.processingState.set('success');
      this.statusMessage.set('Password has been reset successfully. You can now sign in.');
      await this.router.navigate(
        ['/sign-in'],
        email === '' ? undefined : { queryParams: { email } },
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Failed to reset password.';
      this.processingState.set('error');
      this.statusMessage.set(message);
    }
  }

  /**
   * Attempt to sign in with the given email and password after a password reset.
   * If sign-in succeeds, also attempts to mark email as verified (best-effort).
   * If verification fails, the user still lands on the dashboard and can
   * re-verify through the standard email verification flow.
   * @returns true if sign-in succeeded, false otherwise
   */
  private async attemptAutoSignIn(email: string, password: string): Promise<boolean> {
    if (email === '') {
      return false;
    }

    try {
      await this.authService.signInWithEmail(email, password);
    } catch (signInError: unknown) {
      console.error('Auto-sign-in after password reset failed:', {
        email,
        error: signInError instanceof Error ? signInError.message : String(signInError),
      });
      return false;
    }

    // Now authenticated -- mark email as verified (best-effort, failure is non-blocking)
    try {
      await this.membershipService.verifyEmail();
    } catch (verifyError: unknown) {
      console.error('Email verification failed after password reset:', {
        error: verifyError instanceof Error ? verifyError.message : String(verifyError),
      });
    }

    return true;
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
      this.authService.sendPasswordResetEmail(restoredEmail).catch((resetError: unknown) => {
        console.error('Failed to send post-recovery password reset email:', {
          email: restoredEmail,
          error: resetError instanceof Error ? resetError.message : String(resetError),
        });
      });
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
