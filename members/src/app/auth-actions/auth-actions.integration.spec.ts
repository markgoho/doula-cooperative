import { ChangeDetectionStrategy, Component } from '@angular/core';
import { provideRouter, Router, RouterOutlet, withComponentInputBinding } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { AuthActions } from './auth-actions';

// Mock components for routing
@Component({
  selector: 'app-membership',
  template: '<h1>Membership Page</h1><p>Welcome to your membership dashboard</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockMembership {}

@Component({
  selector: 'app-sign-in',
  template: '<h1>Sign In Page</h1><p>Please sign in to continue</p>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockSignIn {}

// Root component that mimics the app structure
@Component({
  selector: 'app-root',
  template: '<router-outlet></router-outlet>',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockApp {}

describe('AuthActions - Integration Tests', () => {
  describe('verifyEmail navigation flow', () => {
    it('should navigate to membership page after successful email verification', async () => {
      await setup({
        mode: 'verifyEmail',
        oobCode: 'valid-code',
      });

      expect(await screen.findByText('Membership Page')).toBeVisible();
    });

    it('should stay on auth-actions page when verification fails', async () => {
      await setup({
        mode: 'verifyEmail',
        oobCode: 'invalid-code',
        shouldSucceed: false,
        errorMessage: 'Invalid verification code',
      });

      expect(await screen.findByText('There was a problem')).toBeVisible();
      expect(screen.queryByText('Membership Page')).toBeNull();
      expect(screen.queryByText('Sign In Page')).toBeNull();
    });
  });

  describe('resetPassword navigation flow', () => {
    it('should navigate to membership page after successful password reset with auto-sign-in', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newSecurePassword123');
      await user.type(confirmPasswordInput, 'newSecurePassword123');
      await user.click(submitButton);

      expect(await screen.findByText('Membership Page')).toBeVisible();
    });

    it('should navigate to sign-in page when auto-sign-in fails after password reset', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code',
        signInShouldSucceed: false,
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newSecurePassword123');
      await user.type(confirmPasswordInput, 'newSecurePassword123');
      await user.click(submitButton);

      expect(await screen.findByText('Sign In Page')).toBeVisible();
    });

    it('should navigate to membership even when verifyEmail fails after sign-in', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code',
        verifyEmailShouldSucceed: false,
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newSecurePassword123');
      await user.type(confirmPasswordInput, 'newSecurePassword123');
      await user.click(submitButton);

      expect(await screen.findByText('Membership Page')).toBeVisible();
    });

    it('should navigate to sign-in when email is empty after password reset', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code',
        userEmail: '',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newSecurePassword123');
      await user.type(confirmPasswordInput, 'newSecurePassword123');
      await user.click(submitButton);

      expect(await screen.findByText('Sign In Page')).toBeVisible();
    });

    it('should stay on auth-actions page when password reset fails', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-fail',
        verifyCodeShouldSucceed: true,
        confirmResetShouldSucceed: false,
        errorMessage: 'Password reset failed',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newPassword123');
      await user.type(confirmPasswordInput, 'newPassword123');
      await user.click(submitButton);

      expect(await screen.findByText('There was a problem')).toBeVisible();
      expect(screen.queryByText('Sign In Page')).toBeNull();
    });

    it('should stay on auth-actions page when code verification fails', async () => {
      await setup({
        mode: 'resetPassword',
        oobCode: 'invalid-reset-code',
        verifyCodeShouldSucceed: false,
        errorMessage: 'Invalid or expired code',
      });

      expect(await screen.findByText('There was a problem')).toBeVisible();
      expect(screen.queryByText('Sign In Page')).toBeNull();
    });
  });

  describe('recoverEmail navigation flow', () => {
    it('should navigate to sign-in page after successful email recovery', async () => {
      await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code',
      });

      expect(await screen.findByText('Sign In Page')).toBeVisible();
    });

    it('should stay on auth-actions page when email recovery fails', async () => {
      await setup({
        mode: 'recoverEmail',
        oobCode: 'invalid-recover-code',
        shouldSucceed: false,
        errorMessage: 'Invalid recovery code',
      });

      expect(await screen.findByText('There was a problem')).toBeVisible();
      expect(screen.queryByText('Sign In Page')).toBeNull();
    });

    it.skip('should respect continueUrl and redirect externally', async () => {
      await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code',
        continueUrl: 'https://example.com/custom',
      });

      // Note: Testing globalThis.location.href is difficult in unit tests
      // This test documents that the continueUrl parameter is accepted
      // The actual redirect behavior is tested in the unit tests
    });
  });
});

interface SetupIntegrationOptions {
  mode?: 'verifyEmail' | 'resetPassword' | 'recoverEmail';
  oobCode?: string;
  continueUrl?: string;
  // Behavior options - describe what should happen, not how
  shouldSucceed?: boolean;
  verifyCodeShouldSucceed?: boolean;
  confirmResetShouldSucceed?: boolean;
  signInShouldSucceed?: boolean;
  verifyEmailShouldSucceed?: boolean;
  errorMessage?: string;
  restoredEmail?: string;
  userEmail?: string;
}

async function setup({
  mode,
  oobCode,
  continueUrl,
  shouldSucceed = true,
  verifyCodeShouldSucceed = shouldSucceed,
  confirmResetShouldSucceed = shouldSucceed,
  signInShouldSucceed = true,
  verifyEmailShouldSucceed = true,
  errorMessage = 'An error occurred',
  restoredEmail = 'restored@example.com',
  userEmail = 'user@example.com',
}: SetupIntegrationOptions = {}) {
  // Build the route from semantic parameters
  const queryParameters = new URLSearchParams();
  if (mode) queryParameters.set('mode', mode);
  if (oobCode) queryParameters.set('oobCode', oobCode);
  if (continueUrl) queryParameters.set('continueUrl', continueUrl);
  const initialRoute = `/auth-actions?${queryParameters.toString()}`;

  // Helper to create rejection value
  const createRejection = () => Promise.reject(new Error(errorMessage));

  // Create mock implementations based on behavior options
  const mockAuthService = {
    applyActionCode: vi
      .fn()
      .mockImplementation(() => (shouldSucceed ? Promise.resolve() : createRejection())),
    reloadUser: vi.fn().mockResolvedValue(undefined),
    verifyPasswordResetCode: vi
      .fn()
      .mockImplementation(() =>
        verifyCodeShouldSucceed ? Promise.resolve(userEmail) : createRejection(),
      ),
    confirmPasswordReset: vi
      .fn()
      .mockImplementation(() =>
        confirmResetShouldSucceed ? Promise.resolve() : createRejection(),
      ),
    checkActionCode: vi
      .fn()
      .mockImplementation(() =>
        shouldSucceed ? Promise.resolve({ data: { email: restoredEmail } }) : createRejection(),
      ),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
    signInWithEmail: vi
      .fn()
      .mockImplementation(() =>
        signInShouldSucceed
          ? Promise.resolve({ user: { uid: 'test-uid' } })
          : Promise.reject(new Error('Sign in failed')),
      ),
  };

  const mockMembershipService = {
    verifyEmail: vi
      .fn()
      .mockImplementation(() =>
        verifyEmailShouldSucceed
          ? Promise.resolve()
          : Promise.reject(new Error('Unable to verify email. Please try again.')),
      ),
  };

  // Set up routes that match the real app structure
  const routes = [
    { path: '', redirectTo: '/sign-in', pathMatch: 'full' as const },
    { path: 'auth-actions', component: AuthActions },
    { path: 'membership', component: MockMembership },
    { path: 'sign-in', component: MockSignIn },
  ];

  const view = await render(MockApp, {
    providers: [
      provideRouter(routes, withComponentInputBinding()),
      { provide: AuthService, useValue: mockAuthService },
      { provide: MembershipService, useValue: mockMembershipService },
    ],
  });

  // IMPORTANT: Call userEvent.setup() AFTER render() to avoid ApplicationRef destroyed warnings
  const user = userEvent.setup();

  const router = view.fixture.debugElement.injector.get(Router);

  // Navigate to the initial route
  await router.navigateByUrl(initialRoute);
  view.fixture.detectChanges();

  return { user, mockAuthService, router };
}
