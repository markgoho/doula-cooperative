import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { SignUp } from './sign-up';

describe('SignUp', () => {
  it('should render heading', async () => {
    await setup();
    expect(screen.getByRole('heading', { name: 'Join the Doula Cooperative' })).toBeVisible();
  });

  it('should render email input', async () => {
    await setup();
    expect(screen.getByLabelText('Email Address')).toBeVisible();
  });

  it('should render password input', async () => {
    await setup();
    expect(screen.getByLabelText('Password')).toBeVisible();
  });

  it('should render confirm password input', async () => {
    await setup();
    expect(screen.getByLabelText('Confirm Password')).toBeVisible();
  });

  it('should render create account button', async () => {
    await setup();
    expect(screen.getByRole('button', { name: 'Create Account' })).toBeVisible();
  });

  it('should show link to sign in page', async () => {
    await setup();
    expect(screen.getByRole('link', { name: 'Sign In' })).toBeVisible();
  });

  it('should disable submit button when form is invalid', async () => {
    await setup();
    const submitButton = screen.getByRole('button', { name: 'Create Account' });
    expect(submitButton).toBeDisabled();
  });

  describe('Email validation', () => {
    it('should show required error when email is touched but empty', async () => {
      const { user } = await setup();

      await user.click(screen.getByLabelText('Email Address'));
      await user.tab();

      expect(screen.getByText('Email is required')).toBeVisible();
    });

    it('should show invalid email error when email format is wrong', async () => {
      const { user } = await setup();

      await fillEmail(user, 'invalid-email');
      await user.tab();

      expect(screen.getByText('Please enter a valid email address')).toBeVisible();
    });

    it('should not show required error when valid email is entered', async () => {
      const { user } = await setup();

      await fillEmail(user, 'test@example.com');
      await user.tab();

      expect(screen.queryByText('Email is required')).not.toBeInTheDocument();
    });

    it('should not show format error when valid email is entered', async () => {
      const { user } = await setup();

      await fillEmail(user, 'test@example.com');
      await user.tab();

      expect(screen.queryByText('Please enter a valid email address')).not.toBeInTheDocument();
    });
  });

  describe('Password validation', () => {
    it('should show required error when password is touched but empty', async () => {
      const { user } = await setup();

      await user.click(screen.getByLabelText('Password'));
      await user.tab();

      expect(screen.getByText('Password is required')).toBeVisible();
    });

    it('should show minlength error when password is too short', async () => {
      const { user } = await setup();

      await fillPassword(user, '12345');
      await user.tab();

      expect(screen.getByText('Password must be at least 6 characters')).toBeVisible();
    });

    it('should not show required error when password meets requirements', async () => {
      const { user } = await setup();

      await fillPassword(user, '123456');
      await user.tab();

      expect(screen.queryByText('Password is required')).not.toBeInTheDocument();
    });

    it('should not show minlength error when password meets requirements', async () => {
      const { user } = await setup();

      await fillPassword(user, '123456');
      await user.tab();

      expect(screen.queryByText('Password must be at least 6 characters')).not.toBeInTheDocument();
    });
  });

  describe('Confirm Password validation', () => {
    it('should show required error when confirm password is touched but empty', async () => {
      const { user } = await setup();

      await user.click(screen.getByLabelText('Confirm Password'));
      await user.tab();

      expect(screen.getByText('Please confirm your password')).toBeVisible();
    });

    it('should show mismatch error when passwords do not match', async () => {
      const { user } = await setup();

      await fillPassword(user, '123456');
      await fillConfirmPassword(user, '654321');
      await user.tab();

      expect(screen.getByText('Passwords do not match')).toBeVisible();
    });

    it('should not show required error when passwords match', async () => {
      const { user } = await setup();

      await fillPassword(user, '123456');
      await fillConfirmPassword(user, '123456');
      await user.tab();

      expect(screen.queryByText('Please confirm your password')).not.toBeInTheDocument();
    });

    it('should not show mismatch error when passwords match', async () => {
      const { user } = await setup();

      await fillPassword(user, '123456');
      await fillConfirmPassword(user, '123456');
      await user.tab();

      expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument();
    });
  });

  describe('Form submission', () => {
    it('should enable submit button when form is valid', async () => {
      const { user } = await setup();

      await fillValidForm(user);

      const submitButton = screen.getByRole('button', { name: 'Create Account' });
      expect(submitButton).toBeEnabled();
    });

    it('should call signUpWithEmail with correct credentials when form is submitted', async () => {
      const { user, mockAuthService } = await setup();

      await fillValidForm(user);
      await submitForm(user);

      expect(mockAuthService.signUpWithEmail).toHaveBeenCalledWith('test@example.com', '123456');
    });

    it('should show loading state during sign up', async () => {
      let resolveSignUp: () => void;
      const signUpPromise = new Promise<void>((resolve) => {
        resolveSignUp = resolve;
      });

      const { user } = await setup({ signUpResponse: signUpPromise });

      await fillValidForm(user);
      await submitForm(user);

      expect(screen.getByText('Creating Account...')).toBeVisible();

      resolveSignUp!();
    });

    it('should display error message when sign up fails', async () => {
      const { user } = await setup({ signUpError: new Error('Email already in use') });

      await fillValidForm(user);
      await submitForm(user);

      expect(await screen.findByText('Email already in use')).toBeVisible();
    });

    it('should keep submit button disabled when form is invalid', async () => {
      const { user } = await setup();

      await fillEmail(user, 'test@example.com');
      await fillPassword(user, '12345'); // Too short

      const submitButton = screen.getByRole('button', { name: 'Create Account' });
      expect(submitButton).toBeDisabled();
    });
  });
});

interface SetupOptions {
  signUpResponse?: Promise<void>;
  signUpError?: Error;
}

async function setup(options: SetupOptions = {}) {
  const { signUpResponse, signUpError } = options;

  const user = userEvent.setup();

  const mockAuthService = {
    signUpWithEmail: signUpError
      ? vi.fn().mockRejectedValue(signUpError)
      : vi.fn().mockResolvedValue(signUpResponse),
  };

  await render(SignUp, {
    providers: [{ provide: AuthService, useValue: mockAuthService }],
  });

  return { user, mockAuthService };
}

// Helper functions for common user actions
async function fillEmail(user: ReturnType<typeof userEvent.setup>, email: string) {
  await user.type(screen.getByLabelText('Email Address'), email);
}

async function fillPassword(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.type(screen.getByLabelText('Password'), password);
}

async function fillConfirmPassword(user: ReturnType<typeof userEvent.setup>, password: string) {
  await user.type(screen.getByLabelText('Confirm Password'), password);
}

async function fillValidForm(user: ReturnType<typeof userEvent.setup>) {
  await fillEmail(user, 'test@example.com');
  await fillPassword(user, '123456');
  await fillConfirmPassword(user, '123456');
}

async function submitForm(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Create Account' }));
}
