import { inputBinding } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { SignIn } from './sign-in';

const { mockAuth, mockGetIdTokenResult } = vi.hoisted(() => ({
  mockAuth: {
    currentUser: undefined as { uid: string } | null | undefined,
    authStateReady: vi.fn<() => Promise<void>>(() => Promise.resolve()),
  },
  mockGetIdTokenResult: vi.fn(),
}));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => mockAuth,
  connectAuthEmulator: vi.fn(),
  getIdTokenResult: mockGetIdTokenResult,
}));

describe('SignIn (Admin)', () => {
  it('should render the sign in form', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Admin Portal' })).toBeVisible();
    expect(screen.getByLabelText('Email Address')).toBeVisible();
    expect(screen.getByLabelText('Password')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Forgot your password?' })).toBeVisible();
  });

  it('should show unauthorized message when message input is unauthorized', async () => {
    await setup({ message: 'unauthorized' });

    expect(
      screen.getByText(
        'Access denied. You must be signed in with an administrator account to view that page.',
      ),
    ).toBeVisible();
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

    await user.type(screen.getByLabelText('Email Address'), 'admin@example.com');
    expect(screen.getByRole('button', { name: 'Sign In' })).toBeDisabled();
  });

  it('should enable submit button when form is valid', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('Email Address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');

    expect(screen.getByRole('button', { name: 'Sign In' })).toBeEnabled();
  });

  it('should allow admin user to sign in and navigate to root', async () => {
    const { user, mockAuthService, navigateSpy } = await setup({ isAdmin: true });

    await user.type(screen.getByLabelText('Email Address'), 'admin@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(mockAuthService.signInWithEmail).toHaveBeenCalledWith(
      'admin@example.com',
      'password123',
    );
    expect(navigateSpy).toHaveBeenCalledWith(['/']);
  });

  it('should reject non-admin user, sign them out, and display error', async () => {
    const { user, mockAuthService, navigateSpy } = await setup({ isAdmin: false });

    await user.type(screen.getByLabelText('Email Address'), 'nonadmin@example.com');
    await user.type(screen.getByLabelText('Password'), 'password123');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(mockAuthService.signOut).toHaveBeenCalled();
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(
      screen.getByText('Access denied. This portal is for cooperative administrators only.'),
    ).toBeVisible();
  });

  it('should show error when authentication fails', async () => {
    const { user } = await setup({ signInError: new Error('Invalid email or password.') });

    await user.type(screen.getByLabelText('Email Address'), 'wrong@example.com');
    await user.type(screen.getByLabelText('Password'), 'wrongpass');
    await user.click(screen.getByRole('button', { name: 'Sign In' }));

    expect(screen.getByText('Invalid email or password.')).toBeVisible();
  });
});

interface SetupOptions {
  signInError?: Error;
  message?: string;
  isAdmin?: boolean;
}

async function setup({ signInError, message, isAdmin = true }: SetupOptions = {}) {
  const mockUser = { uid: 'test-admin-uid' };

  mockGetIdTokenResult.mockResolvedValue({
    claims: { admin: isAdmin },
    token: 'mock-token',
  });

  const mockAuthService = {
    signInWithEmail: vi.fn().mockImplementation(async () => {
      if (signInError) throw signInError;
      return { user: mockUser };
    }),
    signOut: vi.fn().mockResolvedValue(undefined),
  };

  await render(SignIn, {
    providers: [{ provide: AuthService, useValue: mockAuthService }, provideRouter([])],
    bindings: [inputBinding('message', () => message)],
  });

  const router = TestBed.inject(Router);
  const navigateSpy = vi.spyOn(router, 'navigate').mockResolvedValue(true);

  const user = userEvent.setup();

  return { user, mockAuthService, navigateSpy };
}
