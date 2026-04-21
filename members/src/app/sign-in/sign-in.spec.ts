import { inputBinding } from '@angular/core';
import { provideRouter } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { SignIn } from './sign-in';

describe('SignIn', () => {
  it('should render the sign in form', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
    expect(screen.getByLabelText('Email Address')).toBeVisible();
    expect(screen.getByLabelText('Password')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toBeVisible();
  });

  it('should show validation errors when fields are touched but empty', async () => {
    const { user } = await setup();

    await user.click(screen.getByLabelText('Email Address'));
    await user.tab();
    await user.tab();

    expect(screen.getByText('Email is required')).toBeVisible();
    expect(screen.getByText('Password is required')).toBeVisible();
  });

  it('should show validation error for invalid email', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('Email Address'), 'not-an-email');
    await user.click(screen.getByLabelText('Password'));

    expect(screen.getByText('Please enter a valid email address')).toBeVisible();
  });

  it('should disable submit button when form is invalid', async () => {
    const { user } = await setup();

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });

  it('should enable submit button when form is valid', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  it('should allow user to sign in with valid credentials', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    // User should see no error message after successful sign in
    expect(screen.queryByText(/error/i)).toBeNull();
  });

  it('should show loading state during sign in', async () => {
    const { user } = await setup({
      signInDelay: 100,
    });

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByRole('button', { name: 'Signing In...' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Signing In...' })).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Signing In...' })).toBeNull();
    });
  });

  it('should display error message when sign in fails', async () => {
    const { user } = await setup({
      signInError: new Error('Invalid credentials'),
    });

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Invalid credentials')).toBeVisible();
  });

  it('should clear error message when submitting form again', async () => {
    let shouldFail = true;
    const { user } = await setup({
      signInImplementation: async () => {
        if (shouldFail) {
          throw new Error('Invalid credentials');
        }
      },
    });

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrong-password');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Invalid credentials')).toBeVisible();

    shouldFail = false;
    await user.clear(screen.getByLabelText('Password'));
    await user.type(screen.getByLabelText('Password'), 'correct-password');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.queryByText('Invalid credentials')).toBeNull();
  });

  it('should sync member email after sign-in when redirected from email change flow', async () => {
    const { user, syncAuthEmailToMember } = await setup({
      message: 'email-changed',
    });

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    await waitFor(() => {
      expect(syncAuthEmailToMember).toHaveBeenCalledOnce();
    });
  });

  it('should show sync errors after sign-in when email recovery sync fails', async () => {
    const { user } = await setup({
      message: 'email-changed',
      syncEmailError: new Error('You must be signed in to update your email.'),
    });

    await user.type(screen.getByLabelText('Email Address'), 'test@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(await screen.findByText('You must be signed in to update your email.')).toBeVisible();
  });
});

interface SetupOptions {
  signInError?: Error;
  signInDelay?: number;
  signInImplementation?: () => Promise<void>;
  message?: string;
  syncEmailError?: Error;
}

async function setup({
  signInError,
  signInDelay,
  signInImplementation,
  message,
  syncEmailError,
}: SetupOptions = {}) {
  const mockAuthService = {
    signInWithEmail: vi.fn().mockImplementation(
      signInImplementation ||
        (async () => {
          if (signInDelay) {
            await new Promise((resolve) => setTimeout(resolve, signInDelay));
          }
          if (signInError) {
            throw signInError;
          }
        }),
    ),
  };

  const syncAuthEmailToMember = vi.fn().mockImplementation(async () => {
    if (syncEmailError) {
      throw syncEmailError;
    }
  });

  await render(SignIn, {
    providers: [
      {
        provide: AuthService,
        useValue: mockAuthService,
      },
      {
        provide: MembershipService,
        useValue: { syncAuthEmailToMember },
      },
      provideRouter([]),
    ],
    bindings: [inputBinding('message', () => message)],
  });

  const user = userEvent.setup();

  return { user, syncAuthEmailToMember };
}
