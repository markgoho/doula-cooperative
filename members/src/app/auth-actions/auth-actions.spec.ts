import { inputBinding } from '@angular/core';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { AuthActions } from './auth-actions';

type AuthActionMode = 'verifyAndChangeEmail' | 'verifyEmail' | 'resetPassword' | 'recoverEmail';

describe('AuthActions - Unit Tests', () => {
  describe('verifyEmail mode', () => {
    it('should show processing state', async () => {
      await setup({
        mode: 'verifyEmail',
        oobCode: 'valid-code-123',
      });

      expect(await screen.findByText('Processing...')).toBeVisible();
    });

    it('should call applyActionCode with the code', async () => {
      const { mockAuthService } = await setup({
        mode: 'verifyEmail',
        oobCode: 'valid-code-123',
      });

      expect(mockAuthService.applyActionCode).toHaveBeenCalledWith('valid-code-123');
      expect(mockAuthService.reloadUser).toHaveBeenCalled();
    });

    it('should display error message when action code is invalid', async () => {
      const { mockAuthService } = await setup({
        mode: 'verifyEmail',
        oobCode: 'invalid-code',
        shouldSucceed: false,
        errorMessage: 'Invalid action code',
      });

      expect(await screen.findByText('There was a problem')).toBeVisible();
      expect(await screen.findByText('Invalid action code')).toBeVisible();
      expect(mockAuthService.applyActionCode).toHaveBeenCalledWith('invalid-code');
    });

    it('should handle network errors gracefully', async () => {
      await setup({
        mode: 'verifyEmail',
        oobCode: 'network-error-code',
        shouldSucceed: false,
        errorMessage: 'Network request failed',
      });

      expect(await screen.findByText('There was a problem')).toBeVisible();
      expect(await screen.findByText('Network request failed')).toBeVisible();
    });

    it('should sync the member email after verifyAndChangeEmail', async () => {
      const { navigateSpy, syncAuthEmailToMember } = await setup({
        mode: 'verifyAndChangeEmail',
        oobCode: 'change-email-code',
      });

      await waitFor(() => {
        expect(syncAuthEmailToMember).toHaveBeenCalledOnce();
      });
      expect(navigateSpy).toHaveBeenCalledWith(['/membership']);
    });

    it('should skip sync for verifyEmail', async () => {
      const { syncAuthEmailToMember } = await setup({
        mode: 'verifyEmail',
        oobCode: 'verify-email-code',
      });

      await waitFor(() => {
        expect(syncAuthEmailToMember).not.toHaveBeenCalled();
      });
    });
  });

  describe('resetPassword mode', () => {
    it('should show reset form after initial processing', async () => {
      await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-123',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();
    });

    it('should verify code and show password reset form', async () => {
      const { mockAuthService } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-123',
      });

      expect(mockAuthService.verifyPasswordResetCode).toHaveBeenCalledWith('reset-code-123');
      expect(await screen.findByText('Reset your password')).toBeVisible();
      expect(await screen.findByText(/Setting a new password for/)).toBeVisible();
      expect(await screen.findByText('user@example.com')).toBeVisible();
    });

    it('should show generic message when email is not available', async () => {
      await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-456',
        userEmail: '',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();
      expect(await screen.findByText('Enter your new password below.')).toBeVisible();
    });

    it('should successfully reset password with valid inputs', async () => {
      const { user, mockAuthService } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-789',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newPassword123');
      await user.type(confirmPasswordInput, 'newPassword123');
      await user.click(submitButton);

      expect(mockAuthService.confirmPasswordReset).toHaveBeenCalledWith(
        'reset-code-789',
        'newPassword123',
      );
    });

    it('should show validation error when password is too short', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-short',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, '12345');
      await user.type(confirmPasswordInput, '12345');
      await user.click(submitButton);

      expect(await screen.findByText('Password must be at least 6 characters.')).toBeVisible();
    });

    it('should show error when passwords do not match', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-mismatch',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'differentPassword');
      await user.click(submitButton);

      expect(await screen.findByText('Passwords do not match.')).toBeVisible();
    });

    it('should show validation errors when form is submitted empty', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-empty',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const submitButton = screen.getByRole('button', { name: 'Set new password' });
      await user.click(submitButton);

      expect(await screen.findByText('Password must be at least 6 characters.')).toBeVisible();
      expect(await screen.findByText('Please confirm your password.')).toBeVisible();
    });

    it('should handle password reset failure', async () => {
      const { user, mockAuthService } = await setup({
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

      expect(mockAuthService.confirmPasswordReset).toHaveBeenCalled();
      expect(await screen.findByText('There was a problem')).toBeVisible();
      expect(await screen.findByText('Password reset failed')).toBeVisible();
    });

    it('should handle invalid reset code', async () => {
      await setup({
        mode: 'resetPassword',
        oobCode: 'invalid-reset-code',
        verifyCodeShouldSucceed: false,
        errorMessage: 'Invalid or expired action code',
      });

      expect(await screen.findByText('There was a problem')).toBeVisible();
      expect(await screen.findByText('Invalid or expired action code')).toBeVisible();
    });

    it('should auto-sign-in and navigate to membership after password reset', async () => {
      const { user, mockAuthService, mockMembershipService, navigateSpy } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-auto',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newPassword123');
      await user.type(confirmPasswordInput, 'newPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAuthService.signInWithEmail).toHaveBeenCalledWith(
          'user@example.com',
          'newPassword123',
        );
      });
      expect(mockMembershipService.verifyEmail).toHaveBeenCalledOnce();
      expect(navigateSpy).toHaveBeenCalledWith(['/membership']);
    });

    it('should fall back to sign-in page when auto-sign-in fails', async () => {
      const { user, mockAuthService, navigateSpy } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-signin-fail',
        signInShouldSucceed: false,
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newPassword123');
      await user.type(confirmPasswordInput, 'newPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAuthService.confirmPasswordReset).toHaveBeenCalled();
      });

      // Should show success even though auto-sign-in failed (falls back to sign-in redirect)
      expect(await screen.findByText('Success')).toBeVisible();
      expect(
        screen.getByText('Password has been reset successfully. You can now sign in.'),
      ).toBeVisible();
      expect(navigateSpy).toHaveBeenCalledWith(['/sign-in'], {
        queryParams: { email: 'user@example.com' },
      });
    });

    it('should skip auto-sign-in and redirect to sign-in when email is empty', async () => {
      const { user, mockAuthService, navigateSpy } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-no-email',
        userEmail: '',
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newPassword123');
      await user.type(confirmPasswordInput, 'newPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAuthService.confirmPasswordReset).toHaveBeenCalled();
      });

      expect(mockAuthService.signInWithEmail).not.toHaveBeenCalled();
      expect(await screen.findByText('Success')).toBeVisible();
      expect(navigateSpy).toHaveBeenCalledWith(['/sign-in'], undefined);
    });

    it('should navigate to membership even when verifyEmail fails after sign-in', async () => {
      const { user, mockMembershipService, navigateSpy } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-verify-fail',
        verifyEmailShouldSucceed: false,
      });

      expect(await screen.findByText('Reset your password')).toBeVisible();

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newPassword123');
      await user.type(confirmPasswordInput, 'newPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockMembershipService.verifyEmail).toHaveBeenCalledOnce();
      });

      // Should still navigate to membership dashboard despite verifyEmail failure
      expect(navigateSpy).toHaveBeenCalledWith(['/membership']);
    });
  });

  describe('recoverEmail mode', () => {
    it('should show recovery success message', async () => {
      await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code-123',
      });

      expect(await screen.findByText('Success')).toBeVisible();
      expect(
        await screen.findByText(
          'Your email has been restored. Please check your inbox to secure your account.',
        ),
      ).toBeVisible();
    });

    it('should recover email and show success message', async () => {
      const { mockAuthService } = await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code-123',
      });

      expect(mockAuthService.checkActionCode).toHaveBeenCalledWith('recover-code-123');
      expect(mockAuthService.applyActionCode).toHaveBeenCalledWith('recover-code-123');
      expect(mockAuthService.sendPasswordResetEmail).toHaveBeenCalledWith('restored@example.com');
    });

    it('should handle email recovery without restored email', async () => {
      const { mockAuthService } = await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code-no-email',
        restoredEmail: '',
      });

      expect(mockAuthService.checkActionCode).toHaveBeenCalledWith('recover-code-no-email');
      expect(mockAuthService.applyActionCode).toHaveBeenCalledWith('recover-code-no-email');
      expect(mockAuthService.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('should respect continueUrl when provided', async () => {
      const { mockAuthService } = await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code-continue',
        continueUrl: 'https://example.com/custom-page',
      });

      expect(mockAuthService.checkActionCode).toHaveBeenCalled();
      expect(mockAuthService.applyActionCode).toHaveBeenCalled();

      // Note: We can't easily test globalThis.location.href assignment in unit tests
      // This would be better tested in integration tests
    });

    it('should handle email recovery failure', async () => {
      await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code-fail',
        shouldSucceed: false,
        errorMessage: 'Failed to recover email',
      });

      expect(await screen.findByText('There was a problem')).toBeVisible();
      expect(await screen.findByText('Failed to recover email')).toBeVisible();
    });
  });

  describe('missing code', () => {
    it('should not process when oobCode is empty', async () => {
      const { mockAuthService } = await setup({
        mode: 'verifyEmail',
        oobCode: '',
      });

      // Wait a bit to ensure no processing happens
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(mockAuthService.applyActionCode).not.toHaveBeenCalled();
      expect(mockAuthService.verifyPasswordResetCode).not.toHaveBeenCalled();
      expect(mockAuthService.checkActionCode).not.toHaveBeenCalled();
    });
  });
});

interface SetupOptions {
  mode: AuthActionMode;
  oobCode: string;
  continueUrl?: string;
  lang?: string;
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
  continueUrl = '',
  lang = 'en',
  shouldSucceed = true,
  verifyCodeShouldSucceed = shouldSucceed,
  confirmResetShouldSucceed = shouldSucceed,
  signInShouldSucceed = true,
  verifyEmailShouldSucceed = true,
  errorMessage = 'An error occurred',
  restoredEmail = 'restored@example.com',
  userEmail = 'user@example.com',
}: SetupOptions) {
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
    signInWithEmail: vi
      .fn()
      .mockImplementation(() =>
        signInShouldSucceed
          ? Promise.resolve({ user: { uid: 'test-uid' } })
          : Promise.reject(new Error('Sign in failed')),
      ),
    checkActionCode: vi
      .fn()
      .mockImplementation(() =>
        shouldSucceed ? Promise.resolve({ data: { email: restoredEmail } }) : createRejection(),
      ),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  };

  const syncAuthEmailToMember = vi.fn().mockResolvedValue(undefined);

  const mockMembershipService = {
    verifyEmail: vi
      .fn()
      .mockImplementation(() =>
        verifyEmailShouldSucceed
          ? Promise.resolve()
          : Promise.reject(new Error('Unable to verify email. Please try again.')),
      ),
    syncAuthEmailToMember,
  };

  await render(AuthActions, {
    providers: [
      provideRouter([]),
      { provide: AuthService, useValue: mockAuthService },
      { provide: MembershipService, useValue: mockMembershipService },
    ],
    bindings: [
      inputBinding('mode', () => mode),
      inputBinding('oobCode', () => oobCode),
      inputBinding('continueUrl', () => continueUrl),
      inputBinding('lang', () => lang),
    ],
  });

  const router = TestBed.inject(Router);
  const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const user = userEvent.setup();

  return { user, mockAuthService, mockMembershipService, navigateSpy, syncAuthEmailToMember };
}
