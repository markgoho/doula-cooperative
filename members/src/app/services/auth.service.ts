import { Injectable, inject } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import {
  type ActionCodeInfo,
  type User,
  type UserCredential,
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  onIdTokenChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  verifyBeforeUpdateEmail,
  verifyPasswordResetCode,
} from 'firebase/auth';
import { Router } from '@angular/router';
import { Observable, from, map, switchMap } from 'rxjs';
import { auth } from '../lib/firebase';

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
  'auth/network-request-failed': 'Network error. Please check your connection and try again.',
  'auth/requires-recent-login':
    'For security, please sign out and sign back in before changing your email.',
  'auth/unknown-error': 'An error occurred during authentication. Please try again.',
};

// Observable that emits on every ID token change (sign-in, sign-out, token refresh)
const idTokenChanged$ = new Observable<User | null>((subscriber) => {
  const unsubscribe = onIdTokenChanged(auth, (user) => subscriber.next(user));
  return unsubscribe;
});

@Injectable({
  providedIn: 'root',
})
export class AuthService {
  private router = inject(Router);

  // Public signal for auth state; re-emits on ID token changes (emailVerified, claims)
  readonly user$ = idTokenChanged$.pipe(map(() => auth.currentUser));
  readonly userId$ = this.user$.pipe(map((user) => user?.uid));
  // eslint-disable-next-line unicorn/no-null
  readonly user = toSignal(this.user$, { initialValue: null });

  // Derived signal that tracks emailVerified and re-emits on ID token changes
  readonly emailVerified = toSignal(
    idTokenChanged$.pipe(map(() => auth.currentUser?.emailVerified ?? false)),
    { initialValue: false },
  );

  // Derived signal for admin status from custom claims
  readonly isAdmin = toSignal(
    idTokenChanged$.pipe(
      switchMap(() => {
        const user = auth.currentUser;
        if (!user) return from(Promise.resolve(false));
        return from(user.getIdTokenResult().then((result) => result.claims['admin'] === true));
      }),
    ),
    { initialValue: false },
  );

  // Sign in with email and password
  async signInWithEmail(email: string, password: string): Promise<UserCredential> {
    try {
      return await signInWithEmailAndPassword(auth, email, password);
    } catch (error) {
      throw this.translateAuthError(error, 'signInWithEmail');
    }
  }

  // Sign out
  async signOut(): Promise<void> {
    try {
      await signOut(auth);
      // Only navigate after successful sign out
      void this.router.navigate(['/sign-in']);
    } catch (error) {
      console.error('Sign out failed:', {
        uid: auth.currentUser?.uid,
        error: error instanceof Error ? error.message : String(error),
        code: (error as { code?: string }).code,
      });
      throw new Error('Failed to sign out. Please try closing your browser and signing in again.');
    }
  }

  // Reload the current user's data
  async reloadUser(): Promise<void> {
    const current = auth.currentUser;
    if (!current) return;

    try {
      await current.reload();
    } catch (error) {
      if (this.isExpiredSessionError(error)) {
        console.warn('User session expired after auth state change', {
          uid: current.uid,
          code: (error as { code?: string }).code,
        });
        return;
      }

      console.error('Error reloading user:', error);
      throw new Error('Failed to reload user data.');
    }

    try {
      // Force ID token refresh so downstream listeners (onIdTokenChanged) re-emit
      await current.getIdToken(true);
    } catch (error) {
      if (this.isExpiredSessionError(error)) {
        console.warn('User token expired after auth state change', {
          uid: current.uid,
          code: (error as { code?: string }).code,
        });
        return;
      }

      console.error('Error refreshing user token:', error);
      throw new Error('Failed to reload user data.');
    }
  }

  // Force refresh ID token to get updated custom claims
  async refreshToken(): Promise<void> {
    const current = auth.currentUser;
    if (!current) return;
    try {
      await current.getIdToken(true);
      console.log('🔄 Token refreshed - custom claims updated');
    } catch (error) {
      const errorCode = (error as { code?: string }).code;
      console.error('Token refresh failed:', {
        uid: current.uid,
        error: error instanceof Error ? error.message : String(error),
        code: errorCode,
      });

      // Provide specific error messages based on Firebase error codes
      if (errorCode === 'auth/user-token-expired' || errorCode === 'auth/user-disabled') {
        throw new Error('Your session has expired. Please sign in again.');
      }
      if (errorCode === 'auth/network-request-failed') {
        throw new Error(
          'Network error refreshing session. Please check your connection and try again.',
        );
      }

      throw new Error('Failed to refresh session. Please sign in again.');
    }
  }

  // Get current user (synchronous)
  get currentUser(): User | null {
    return auth.currentUser;
  }

  // Check if user is authenticated
  get isAuthenticated(): boolean {
    return auth.currentUser !== null;
  }

  async resendEmailVerification(): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('No authenticated user');
    }
    try {
      await sendEmailVerification(user, {
        url: `${globalThis.window.location.origin}/membership`,
        handleCodeInApp: true,
      });
    } catch (error) {
      throw this.translateAuthError(error, 'resendEmailVerification', {
        uid: user.uid,
        email: user.email,
      });
    }
  }

  // Firebase Auth Action Code Methods

  /**
   * Apply an action code to complete an auth action (verify email, recover email)
   */
  async applyActionCode(code: string): Promise<void> {
    try {
      await applyActionCode(auth, code);
    } catch (error) {
      throw this.translateAuthError(error, 'applyActionCode');
    }
  }

  /**
   * Check the validity of an action code and get information about it
   */
  async checkActionCode(code: string): Promise<ActionCodeInfo> {
    try {
      return await checkActionCode(auth, code);
    } catch (error) {
      throw this.translateAuthError(error, 'checkActionCode');
    }
  }

  /**
   * Verify a password reset code and get the associated email
   */
  async verifyPasswordResetCode(code: string): Promise<string> {
    try {
      return await verifyPasswordResetCode(auth, code);
    } catch (error) {
      throw this.translateAuthError(error, 'verifyPasswordResetCode');
    }
  }

  /**
   * Confirm a password reset with the new password
   */
  async confirmPasswordReset(code: string, newPassword: string): Promise<void> {
    try {
      await confirmPasswordReset(auth, code, newPassword);
    } catch (error) {
      throw this.translateAuthError(error, 'confirmPasswordReset');
    }
  }

  /**
   * Send a password reset email to a user
   */
  async sendPasswordResetEmail(email: string): Promise<void> {
    try {
      await sendPasswordResetEmail(auth, email, {
        url: `${globalThis.window.location.origin}/auth-actions?mode=resetPassword`,
        handleCodeInApp: true,
      });
    } catch (error) {
      throw this.translateAuthError(error, 'sendPasswordResetEmail', { email });
    }
  }

  async verifyBeforeUpdateEmail(newEmail: string): Promise<void> {
    const user = auth.currentUser;
    if (!user) {
      throw new Error('You must be signed in to change your email.');
    }

    try {
      await verifyBeforeUpdateEmail(user, newEmail, {
        url: `${globalThis.location.origin}/auth-actions`,
        handleCodeInApp: true,
      });
    } catch (error) {
      throw this.translateAuthError(error, 'verifyBeforeUpdateEmail', {
        uid: user.uid,
        newEmail,
      });
    }
  }

  private isExpiredSessionError(error: unknown): boolean {
    const errorCode = (error as { code?: string }).code;
    return errorCode === 'auth/user-token-expired' || errorCode === 'auth/user-disabled';
  }

  private translateAuthError(
    error: unknown,
    method: string,
    context: Record<string, unknown> = {},
  ): Error {
    const errorCode = (error as { code?: string }).code ?? 'auth/unknown-error';
    console.error(`AuthService.${method} failed:`, {
      method,
      errorCode,
      error: error instanceof Error ? error.message : String(error),
      ...context,
    });
    return new Error(AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES['auth/unknown-error']);
  }
}
