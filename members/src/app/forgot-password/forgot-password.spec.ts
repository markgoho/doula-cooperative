import { render, screen, waitFor } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { ForgotPassword } from './forgot-password';

describe('ForgotPassword', () => {
  it('should render the forgot password form', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Reset Password' })).toBeVisible();
    expect(screen.getByLabelText('Email Address')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  it('should show validation error when email field is touched but empty', async () => {
    const { user } = await setup();

    await user.click(screen.getByLabelText('Email Address'));
    await user.tab();

    expect(screen.getByText('Email is required')).toBeVisible();
  });

  it('should show validation error for invalid email', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('Email Address'), 'not-an-email');
    await user.tab();

    expect(screen.getByText('Please enter a valid email address')).toBeVisible();
  });

  it('should disable submit button when form is invalid', async () => {
    await setup();

    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeDisabled();
  });

  it('should enable submit button when form is valid', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');

    expect(screen.getByRole('button', { name: 'Send Reset Link' })).toBeEnabled();
  });

  it('should send password reset email with valid email', async () => {
    const { user, mockAuthService } = await setup();

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(mockAuthService.sendPasswordResetEmail).toHaveBeenCalledWith('test@example.com');
    });
  });

  it('should show loading state during email sending', async () => {
    const { user } = await setup({
      sendEmailDelay: 100,
    });

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    expect(screen.getByRole('button', { name: 'Sending...' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Sending...' })).toBeNull();
    });
  });

  it('should display success message after sending reset email', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'Password reset email sent! Please check your inbox and follow the instructions to reset your password.',
        ),
      ).toBeVisible();
    });
  });

  it('should clear form after successful submission', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.getByLabelText('Email Address')).toHaveValue('');
    });
  });

  it('should display error message when sending fails', async () => {
    const { user } = await setup({
      sendEmailError: new Error('Failed to send reset email'),
    });

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send reset email')).toBeVisible();
    });
  });

  it('should clear error message when submitting form again', async () => {
    let shouldFail = true;
    const { user } = await setup({
      sendEmailImplementation: async () => {
        if (shouldFail) {
          throw new Error('Failed to send reset email');
        }
      },
    });

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send reset email')).toBeVisible();
    });

    shouldFail = false;
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.queryByText('Failed to send reset email')).toBeNull();
    });
  });

  it('should not display success and error messages at the same time', async () => {
    let shouldFail = true;
    const { user } = await setup({
      sendEmailImplementation: async () => {
        if (shouldFail) {
          throw new Error('Failed to send reset email');
        }
      },
    });

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send reset email')).toBeVisible();
    });

    shouldFail = false;
    await user.click(screen.getByRole('button', { name: 'Send Reset Link' }));

    await waitFor(() => {
      expect(screen.queryByText('Failed to send reset email')).toBeNull();
      expect(
        screen.getByText(
          'Password reset email sent! Please check your inbox and follow the instructions to reset your password.',
        ),
      ).toBeVisible();
    });
  });
});

interface SetupOptions {
  sendEmailError?: Error;
  sendEmailDelay?: number;
  sendEmailImplementation?: () => Promise<void>;
}

async function setup(options: SetupOptions = {}) {
  const mockAuthService = {
    sendPasswordResetEmail: vi.fn().mockImplementation(
      options.sendEmailImplementation ||
        (async () => {
          if (options.sendEmailDelay) {
            await new Promise((resolve) => setTimeout(resolve, options.sendEmailDelay));
          }
          if (options.sendEmailError) {
            throw options.sendEmailError;
          }
        }),
    ),
  };

  await render(ForgotPassword, {
    providers: [
      {
        provide: AuthService,
        useValue: mockAuthService,
      },
    ],
  });

  const user = userEvent.setup();

  return { user, mockAuthService };
}
