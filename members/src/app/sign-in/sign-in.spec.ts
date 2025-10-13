import { render, screen } from '@testing-library/angular';
import userEvent from '@testing-library/user-event';
import { expect, it, vi } from 'vitest';
import { AuthService } from '../services/auth.service';
import { SignIn } from './sign-in';

it('should render', async () => {
  await setup();

  expect(screen.getByRole('heading', { name: 'Welcome Back' })).toBeVisible();
});

async function setup() {
  const user = userEvent.setup();
  await render(SignIn, {
    providers: [
      {
        provide: AuthService,
        useValue: {
          signInWithEmail: vi.fn(),
        },
      },
    ],
  });
  return { user };
}
