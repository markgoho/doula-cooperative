import { provideRouter } from '@angular/router';
import { render, screen, waitFor } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { ChangeEmail } from './change-email';

describe('ChangeEmail', () => {
  it('should render the change email form', async () => {
    await setup();

    expect(screen.getByRole('heading', { name: 'Change Email Address' })).toBeVisible();
    expect(screen.getByLabelText('New Email Address')).toBeVisible();
    expect(screen.getByRole('button', { name: 'Send Verification Link' })).toBeVisible();
    expect(screen.getByRole('link', { name: 'Back to Membership' })).toBeVisible();
  });

  it('should show validation error when email field is touched but empty', async () => {
    const { user } = await setup();

    await user.click(screen.getByLabelText('New Email Address'));
    await user.tab();

    expect(screen.getByText('Email is required')).toBeVisible();
  });

  it('should show validation error for invalid email', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('New Email Address'), 'not-an-email');
    await user.tab();

    expect(screen.getByText('Please enter a valid email address')).toBeVisible();
  });

  it('should disable submit button when form is invalid', async () => {
    await setup();

    expect(screen.getByRole('button', { name: 'Send Verification Link' })).toBeDisabled();
  });

  it('should enable submit button when form is valid', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('New Email Address'), 'new@example.com');

    expect(screen.getByRole('button', { name: 'Send Verification Link' })).toBeEnabled();
  });

  it('should show loading state during email sending', async () => {
    const { user } = await setup({
      sendEmailImplementation: async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));
      },
    });

    await user.type(screen.getByLabelText('New Email Address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Verification Link' }));

    expect(screen.getByRole('button', { name: 'Sending...' })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Sending...' })).toBeDisabled();

    await waitFor(() => {
      expect(screen.queryByRole('button', { name: 'Sending...' })).toBeNull();
    });
  });

  it('should display success message after sending verification email', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('New Email Address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Verification Link' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          "We've sent a verification link to new@example.com. Click it to complete the change. You'll also get a notice at your current email.",
        ),
      ).toBeVisible();
    });
  });

  it('should clear form after successful submission', async () => {
    const { user } = await setup();

    await user.type(screen.getByLabelText('New Email Address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Verification Link' }));

    await waitFor(() => {
      expect(screen.getByLabelText('New Email Address')).toHaveValue('');
    });
  });

  it('should display error message when sending fails', async () => {
    const { user } = await setup({
      sendEmailImplementation: async () => {
        throw new Error('Failed to send verification email');
      },
    });

    await user.type(screen.getByLabelText('New Email Address'), 'new@example.com');
    await user.click(screen.getByRole('button', { name: 'Send Verification Link' }));

    await waitFor(() => {
      expect(screen.getByText('Failed to send verification email')).toBeVisible();
    });
  });
});

interface SetupOptions {
  sendEmailImplementation?: () => Promise<void>;
}

async function setup({ sendEmailImplementation }: SetupOptions = {}) {
  const mockAuthService = {
    verifyBeforeUpdateEmail: vi.fn().mockImplementation(sendEmailImplementation || vi.fn()),
  };

  await render(ChangeEmail, {
    providers: [
      {
        provide: AuthService,
        useValue: mockAuthService,
      },
      provideRouter([]),
    ],
  });

  const user = userEvent.setup();

  return { user };
}
