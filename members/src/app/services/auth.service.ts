import { Injectable, inject } from '@angular/core';
import {
  Auth,
  User,
  UserCredential,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  sendEmailVerification,
  signInWithEmailAndPassword,
  signOut,
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
        url: `https://members.doulacooperative.com/verify-email`,
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
        url: `https://members.doulacooperative.com/verify-email`,
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
}
