import { Injectable, inject } from '@angular/core';
import {
  ActionCodeInfo,
  Auth,
  User,
  UserCredential,
  applyActionCode,
  checkActionCode,
  confirmPasswordReset,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signOut,
  verifyPasswordResetCode,
} from '@angular/fire/auth';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Router } from '@angular/router';
import { Observable } from 'rxjs';

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

  // Observable for auth state
  get user$(): Observable<User | null> {
    return new Observable((subscriber) => {
      const unsubscribe = onAuthStateChanged(this.auth, (user) => {
        subscriber.next(user);
      });
      return unsubscribe;
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
        url: `https://doula-coop-members.web.app/firebase-test`,
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
        url: `https://doula-coop-members.web.app/firebase-test`,
        handleCodeInApp: true,
      });
    } catch {
      throw new Error('Failed to send verification email.');
    }
  }

  async setUserEmailVerified(): Promise<void> {
    try {
      const user = this.auth.currentUser;
      if (!user) {
        throw new Error('No authenticated user');
      }

      // Ensure the ID token reflects the latest Auth state after email verification
      // This avoids stale tokens where email_verified may still be false
      await user.reload();

      const setUserEmailVerified = httpsCallable(this.functions, 'setUserEmailVerified');
      await setUserEmailVerified();
    } catch (error) {
      console.error('Error calling setUserEmailVerified function:', error);
      // Preserve the original error message instead of throwing a generic one
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to update email verification status.');
    }
  }

  async claimProfile(): Promise<void> {
    const claimProfileCallable = httpsCallable(this.functions, 'claimProfile');
    try {
      const result = await claimProfileCallable();
      console.log('Profile claim result:', result.data);
    } catch (error) {
      console.error('Error calling claimProfile function:', error);
      // Optionally, handle the error in the UI
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
        url: `https://doula-coop-members.web.app/auth-actions?mode=resetPassword`,
        handleCodeInApp: true,
      });
    } catch (error) {
      const errorCode = (error as { code?: string }).code ?? 'auth/unknown-error';
      throw new Error(AUTH_ERROR_MESSAGES[errorCode] ?? AUTH_ERROR_MESSAGES['auth/unknown-error']);
    }
  }
}
