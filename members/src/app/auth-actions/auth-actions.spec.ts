import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { AuthActions } from './auth-actions';

describe('AuthActions - Unit Tests', () => {
  describe('verifyEmail mode', () => {
    it('should show processing state', async () => {
      await setup({
        mode: 'verifyEmail',
        oobCode: 'valid-code-123',
      });

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeVisible();
      });
    });

    it('should call applyActionCode with the code', async () => {
      const { mockAuthService } = await setup({
        mode: 'verifyEmail',
        oobCode: 'valid-code-123',
      });

      await waitFor(() => {
        expect(mockAuthService.applyActionCode).toHaveBeenCalledWith('valid-code-123');
        expect(mockAuthService.reloadUser).toHaveBeenCalled();
      });
    });

    it('should display error message when action code is invalid', async () => {
      const { mockAuthService } = await setup({
        mode: 'verifyEmail',
        oobCode: 'invalid-code',
        shouldSucceed: false,
        errorMessage: 'Invalid action code',
      });

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeVisible();
      });

      await waitFor(() => {
        expect(screen.getByText('There was a problem')).toBeVisible();
        expect(screen.getByText('Invalid action code')).toBeVisible();
        expect(mockAuthService.applyActionCode).toHaveBeenCalledWith('invalid-code');
      });
    });

    it('should handle network errors gracefully', async () => {
      await setup({
        mode: 'verifyEmail',
        oobCode: 'network-error-code',
        shouldSucceed: false,
        errorMessage: 'Network request failed',
      });

      await waitFor(() => {
        expect(screen.getByText('There was a problem')).toBeVisible();
        expect(screen.getByText('Network request failed')).toBeVisible();
      });
    });
  });

  describe('resetPassword mode', () => {
    it('should show processing state initially', async () => {
      await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-123',
      });

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeVisible();
      });
    });

    it('should verify code and show password reset form', async () => {
      const { mockAuthService } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-123',
      });

      await waitFor(() => {
        expect(mockAuthService.verifyPasswordResetCode).toHaveBeenCalledWith('reset-code-123');
        expect(screen.getByText('Reset your password')).toBeVisible();
        expect(screen.getByText(/Setting a new password for/)).toBeVisible();
        expect(screen.getByText('user@example.com')).toBeVisible();
      });
    });

    it('should show generic message when email is not available', async () => {
      await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-456',
        userEmail: '',
      });

      await waitFor(() => {
        expect(screen.getByText('Reset your password')).toBeVisible();
        expect(screen.getByText('Enter your new password below.')).toBeVisible();
      });
    });

    it('should successfully reset password with valid inputs', async () => {
      const { user, mockAuthService } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-789',
      });

      await waitFor(() => {
        expect(screen.getByText('Reset your password')).toBeVisible();
      });

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newPassword123');
      await user.type(confirmPasswordInput, 'newPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAuthService.confirmPasswordReset).toHaveBeenCalledWith(
          'reset-code-789',
          'newPassword123',
        );
      });
    });

    it('should show validation error when password is too short', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-short',
      });

      await waitFor(() => {
        expect(screen.getByText('Reset your password')).toBeVisible();
      });

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, '12345');
      await user.type(confirmPasswordInput, '12345');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters.')).toBeVisible();
      });
    });

    it('should show error when passwords do not match', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-mismatch',
      });

      await waitFor(() => {
        expect(screen.getByText('Reset your password')).toBeVisible();
      });

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'password123');
      await user.type(confirmPasswordInput, 'differentPassword');
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Passwords do not match.')).toBeVisible();
      });
    });

    it('should show validation errors when form is submitted empty', async () => {
      const { user } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-empty',
      });

      await waitFor(() => {
        expect(screen.getByText('Reset your password')).toBeVisible();
      });

      const submitButton = screen.getByRole('button', { name: 'Set new password' });
      await user.click(submitButton);

      await waitFor(() => {
        expect(screen.getByText('Password must be at least 6 characters.')).toBeVisible();
        expect(screen.getByText('Please confirm your password.')).toBeVisible();
      });
    });

    it('should handle password reset failure', async () => {
      const { user, mockAuthService } = await setup({
        mode: 'resetPassword',
        oobCode: 'reset-code-fail',
        verifyCodeShouldSucceed: true,
        confirmResetShouldSucceed: false,
        errorMessage: 'Password reset failed',
      });

      await waitFor(() => {
        expect(screen.getByText('Reset your password')).toBeVisible();
      });

      const passwordInput = screen.getByLabelText('New password');
      const confirmPasswordInput = screen.getByLabelText('Confirm new password');
      const submitButton = screen.getByRole('button', { name: 'Set new password' });

      await user.type(passwordInput, 'newPassword123');
      await user.type(confirmPasswordInput, 'newPassword123');
      await user.click(submitButton);

      await waitFor(() => {
        expect(mockAuthService.confirmPasswordReset).toHaveBeenCalled();
        expect(screen.getByText('There was a problem')).toBeVisible();
        expect(screen.getByText('Password reset failed')).toBeVisible();
      });
    });

    it('should handle invalid reset code', async () => {
      await setup({
        mode: 'resetPassword',
        oobCode: 'invalid-reset-code',
        verifyCodeShouldSucceed: false,
        errorMessage: 'Invalid or expired action code',
      });

      await waitFor(() => {
        expect(screen.getByText('There was a problem')).toBeVisible();
        expect(screen.getByText('Invalid or expired action code')).toBeVisible();
      });
    });
  });

  describe('recoverEmail mode', () => {
    it('should show processing state', async () => {
      await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code-123',
      });

      await waitFor(() => {
        expect(screen.getByText('Processing...')).toBeVisible();
      });
    });

    it('should recover email and show success message', async () => {
      const { mockAuthService } = await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code-123',
      });

      await waitFor(() => {
        expect(mockAuthService.checkActionCode).toHaveBeenCalledWith('recover-code-123');
        expect(mockAuthService.applyActionCode).toHaveBeenCalledWith('recover-code-123');
        expect(mockAuthService.sendPasswordResetEmail).toHaveBeenCalledWith('restored@example.com');
      });
    });

    it('should handle email recovery without restored email', async () => {
      const { mockAuthService } = await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code-no-email',
        restoredEmail: '',
      });

      await waitFor(() => {
        expect(mockAuthService.checkActionCode).toHaveBeenCalledWith('recover-code-no-email');
        expect(mockAuthService.applyActionCode).toHaveBeenCalledWith('recover-code-no-email');
        expect(mockAuthService.sendPasswordResetEmail).not.toHaveBeenCalled();
      });
    });

    it('should respect continueUrl when provided', async () => {
      const { mockAuthService } = await setup({
        mode: 'recoverEmail',
        oobCode: 'recover-code-continue',
        continueUrl: 'https://example.com/custom-page',
      });

      await waitFor(() => {
        expect(mockAuthService.checkActionCode).toHaveBeenCalled();
        expect(mockAuthService.applyActionCode).toHaveBeenCalled();
      });

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

      await waitFor(() => {
        expect(screen.getByText('There was a problem')).toBeVisible();
        expect(screen.getByText('Failed to recover email')).toBeVisible();
      });
    });
  });

  describe('invalid mode', () => {
    it('should show error for unsupported action mode', async () => {
      await setup({
        mode: 'unsupportedMode',
        oobCode: 'some-code',
      });

      await waitFor(() => {
        expect(screen.getByText('There was a problem')).toBeVisible();
        expect(screen.getByText('Invalid or unsupported action.')).toBeVisible();
      });
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
  mode: 'verifyEmail' | 'resetPassword' | 'recoverEmail' | string;
  oobCode: string;
  continueUrl?: string;
  lang?: string;
  // Behavior options - describe what should happen, not how
  shouldSucceed?: boolean;
  verifyCodeShouldSucceed?: boolean;
  confirmResetShouldSucceed?: boolean;
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
    checkActionCode: vi
      .fn()
      .mockImplementation(() =>
        shouldSucceed ? Promise.resolve({ data: { email: restoredEmail } }) : createRejection(),
      ),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  };

  const user = userEvent.setup();

  await render(AuthActions, {
    providers: [{ provide: AuthService, useValue: mockAuthService }],
    componentInputs: {
      mode,
      oobCode,
      continueUrl,
      lang,
    },
  });

  return { user, mockAuthService };
}
