import { ChangeDetectionStrategy, Component, signal, WritableSignal } from '@angular/core';
import { User } from '@angular/fire/auth';
import { RouterOutlet } from '@angular/router';
import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { App } from './app';
import { AuthService } from './services/auth.service';

@Component({
  selector: 'app-header',
  template: '<div>Mock Header</div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockHeader {}

@Component({
  selector: 'app-footer',
  template: '<div>Mock Footer</div>',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MockFooter {}

describe('App', () => {
  it('should not show verification banner when user is null', async () => {
    await setup({ user: undefined, emailVerified: false });
    const banner = screen.queryByText(/Your email address is not verified/);
    expect(banner).not.toBeInTheDocument();
  });

  it('should not show verification banner when user is verified', async () => {
    const mockUser = { uid: '123', email: 'test@example.com' } as User;
    await setup({ user: mockUser, emailVerified: true });
    const banner = screen.queryByText(/Your email address is not verified/);
    expect(banner).not.toBeInTheDocument();
  });

  it('should show verification banner when user is not verified', async () => {
    const mockUser = { uid: '123', email: 'test@example.com' } as User;
    await setup({ user: mockUser, emailVerified: false });
    const banner = screen.getByText(/Your email address is not verified/);
    expect(banner).toBeVisible();
  });

  it('should show resend button in verification banner', async () => {
    const mockUser = { uid: '123', email: 'test@example.com' } as User;
    await setup({ user: mockUser, emailVerified: false });
    const button = screen.getByRole('button', { name: /Resend Verification Email/ });
    expect(button).toBeVisible();
  });

  it('should call resendEmailVerification when resend button is clicked', async () => {
    const mockUser = { uid: '123', email: 'test@example.com' } as User;
    const { user: userEventInstance, mockAuthService } = await setup({
      user: mockUser,
      emailVerified: false,
    });

    const button = screen.getByRole('button', { name: /Resend Verification Email/ });
    await userEventInstance.click(button);

    expect(mockAuthService.resendEmailVerification).toHaveBeenCalledOnce();
  });
});

interface SetupOptions {
  user?: User | null;
  emailVerified?: boolean;
}

async function setup(options: SetupOptions = {}) {
  const { user: userValue, emailVerified = false } = options;

  const userEventInstance = userEvent.setup();
  const userSignal: WritableSignal<User | null | undefined> = signal(userValue);
  const emailVerifiedSignal: WritableSignal<boolean> = signal(emailVerified);

  const mockAuthService = {
    user: userSignal,
    emailVerified: emailVerifiedSignal,
    resendEmailVerification: vi.fn().mockResolvedValue(undefined),
  };

  await render(App, {
    componentImports: [MockHeader, RouterOutlet, MockFooter],
    providers: [
      {
        provide: AuthService,
        useValue: mockAuthService,
      },
    ],
  });

  return { user: userEventInstance, mockAuthService };
}
