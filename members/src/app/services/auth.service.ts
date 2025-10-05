import { DestroyRef, Injectable, inject, signal } from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import {
  ActionCodeInfo,
  Auth,
  User,
  UserCredential,
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  idToken,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
} from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Router } from '@angular/router';
import { map } from 'rxjs';
import { ProfileService } from './profile.service';

// Global auth error messages object
export const AUTH_ERROR_MESSAGES: Record<string, string> = {
  'auth/email-already-in-use': 'An account with this email already exists.',
  'auth/weak-password': 'Password should be at least 6 characters.',
  'auth/invalid-email': 'Invalid email address.',
  'auth/user-disabled': 'This account has been disabled.',
  'auth/user-not-found': 'No account found with this email address.',
  'auth/wrong-password': 'Incorrect password.',
  'auth/invalid-credential': 'Invalid email or password.',
  'auth/too-many-requests': 'Too many failed attempts. Please try again later.',
  'auth/unknown-error': 'An error occurred during authentication. Please try again.',
};

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private auth = inject(Auth);
  private router = inject(Router);
  private functions = inject(Functions);
  private profileService = inject(ProfileService);
  private destroyRef = inject(DestroyRef);

  private profilePreloaded = signal(false);

  // Public signal for auth state; re-emits on ID token changes (emailVerified, claims)
  readonly user$ = idToken(this.auth).pipe(map(() => this.auth.currentUser));
  readonly userId$ = this.user$.pipe(map((user) => user?.uid));
  // eslint-disable-next-line unicorn/no-null
  readonly user = toSignal(this.user$, { initialValue: null });

  // Derived signal that tracks emailVerified and re-emits on ID token changes
  readonly emailVerified = toSignal(
    idToken(this.auth).pipe(map(() => this.auth.currentUser?.emailVerified ?? false)),
    { initialValue: false },
  );

  constructor() {
    // Preload profile when user logs in (only once per session)
    this.user$.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((user) => {
      if (user && !this.profilePreloaded()) {
        this.profilePreloaded.set(true);
        void this.profileService.preloadProfile();
      } else if (!user) {
        // Reset flag when user logs out
        this.profilePreloaded.set(false);
        this.profileService.clearProfileCache();
      }
    });
  }

  // Sign in with email and password
  async signInWithEmail(email: string, password: string): Promise<UserCredential> {
    try {
      return await signInWithEmailAndPassword(this.auth, email, password);
    } catch (error) {
      const errorCode = (error as { code?: string }).code ?? 'auth/unknown-error';
      throw new Error(AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES['auth/unknown-error']);
    }
  }

  // Sign up with email and password
  async signUpWithEmail(email: string, password: string): Promise<void> {
    try {
      const userCredential = await createUserWithEmailAndPassword(this.auth, email, password);
      await sendEmailVerification(userCredential.user, {
        url: `${globalThis.window.location.origin}/membership`,
        handleCodeInApp: true,
      });
    } catch (error) {
      const errorCode = (error as { code?: string }).code ?? 'auth/unknown-error';
      throw new Error(AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES['auth/unknown-error']);
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(this.auth);
      void this.router.navigate(['/sign-in']);
    } catch (error) {
      console.error('Sign out error:', error);
      throw error;
    }
  }

  // Reload the current user's data
  async reloadUser(): Promise<void> {
    const current = this.auth.currentUser;
    if (!current) return;
    try {
      await current.reload();
      // Force ID token refresh so downstream listeners (onIdTokenChanged) re-emit
      await current.getIdToken(true);
    } catch (error) {
      console.error('Error reloading user:', error);
      throw new Error('Failed to reload user data.');
    }
  }

  // Get current user (synchronous)
  get currentUser(): User | null {
    return this.auth.currentUser;
  }

  // Check if user is authenticated
  get isAuthenticated(): boolean {
    return this.auth.currentUser !== null;
  }

  async resendEmailVerification(): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    try {
      await sendEmailVerification(user, {
        url: `${globalThis.window.location.origin}/membership`,
        handleCodeInApp: true,
      });
    } catch {
      throw new Error('Failed to send verification email.');
    }
  }

  async claimProfile(): Promise<void> {
    const user = this.currentUser;
    if (!user) {
      console.error('Attempted to claim profile without a logged-in user.');
      // Re-throw the error so the component can handle it
      throw new Error('No authenticated user to claim profile.');
    }

    // Force a refresh of the user's ID token to get the latest claims
    // and email_verified status before calling the function.
    await user.getIdToken(true);

    const claimProfileCallable = httpsCallable(this.functions, 'claimProfile');
    try {
      const result = await claimProfileCallable();
      console.log('Profile claim result:', result.data);
    } catch (error) {
      console.error('Error calling claimProfile function:', error);
      // Re-throw the error so the component can handle it
      throw error;
    }
  }

  // Firebase Auth Action Code Methods

  /**
   * Apply an action code to complete an auth action (verify email, recover email)
   */
  async applyActionCode(code: string): Promise<void> {
    try {
      await applyActionCode(this.auth, code);
    } catch (error) {
      const errorCode = (error as { code?: string }).code ?? 'auth/unknown-error';
      throw new Error(AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES['auth/unknown-error']);
    }
  }

  /**
   * Check the validity of an action code and get information about it
   */
  async checkActionCode(code: string): Promise<ActionCodeInfo> {
    try {
      return await checkActionCode(this.auth, code);
    } catch (error) {
      const errorCode = (error as { code?: string }).code ?? 'auth/unknown-error';
      throw new Error(AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES['auth/unknown-error']);
    }
  }

  /**
   * Verify a password reset code and get the associated email
   */
  async verifyPasswordResetCode(code: string): Promise<string> {
    try {
      return await verifyPasswordResetCode(this.auth, code);
    } catch (error) {
      const errorCode = (error as { code?: string }).code ?? 'auth/unknown-error';
      throw new Error(AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES['auth/unknown-error']);
    }
  }

  /**
   * Confirm a password reset with the new password
   */
  async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    try {
      await confirmPasswordReset(this.auth, code, newPassword);
    } catch (error) {
      const errorCode = (error as { code?: string }).code ?? 'auth/unknown-error';
      throw new Error(AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES['auth/unknown-error']);
    }
  }

  /**
   * Send a password reset email to a user
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(this.auth, email, {
        url: `${globalThis.window.location.origin}/auth-actions?mode=resetPassword`,
        handleCodeInApp: true,
      });
    } catch (error) {
      const errorCode = (error as { code?: string }).code ?? 'auth/unknown-error';
      throw new Error(AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES['auth/unknown-error']);
    }
  }
}
