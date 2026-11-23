import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import {
  Router,
  RouterOutlet,
  provideRouter,
  withComponentInputBinding,
  type Routes,
} from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { requireAuth, requireUnauth } from '../app.routes';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { SignIn } from './sign-in';

// Mock at the firebase SDK boundary (vi.mock on relative imports is not allowed).
const { mockAuth } = vi.hoisted(() => ({
  mockAuth: {
    currentUser: undefined as { uid: string } | null | undefined,
    authStateReady: () => Promise.resolve(),
  },
}));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => mockAuth,
  connectAuthEmulator: vi.fn(),
}));

@Component({
  template: '<router-outlet />',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class TestApp {}

@Component({ template: '<h1>Referral page</h1>', changeDetection: ChangeDetectionStrategy.OnPush })
class MockReferral {}

@Component({ template: '<h1>Membership</h1>', changeDetection: ChangeDetectionStrategy.OnPush })
class MockMembership {}

const routes: Routes = [
  { path: 'sign-in', component: SignIn, canActivate: [requireUnauth] },
  { path: 'membership', component: MockMembership, canActivate: [requireAuth] },
  { path: 'referrals/:id', component: MockReferral, canActivate: [requireAuth] },
];

async function setup() {
  mockAuth.currentUser = undefined;
  const signInWithEmail = vi.fn(() => {
    mockAuth.currentUser = { uid: 'member-1' };
    return Promise.resolve();
  });

  await render(TestApp, {
    providers: [
      { provide: AuthService, useValue: { signInWithEmail } },
      { provide: MembershipService, useValue: { syncAuthEmailToMember: vi.fn() } },
      provideRouter(routes, withComponentInputBinding()),
    ],
  });

  const router = TestBed.inject(Router);
  const user = userEvent.setup();

  return {
    router,
    visit: (url: string) => router.navigateByUrl(url),
    signIn: async () => {
      await user.type(await screen.findByLabelText('Email Address'), 'member@example.com');
      await user.type(screen.getByLabelText('Password'), 'password123');
      await user.click(screen.getByRole('button', { name: 'Sign In' }));
    },
  };
}

describe('signing in from a deep link', () => {
  it('lands a signed-out visitor to /referrals/:id on that Referral after sign-in', async () => {
    const { router, visit, signIn } = await setup();

    await visit('/referrals/req-abc');
    expect(await screen.findByRole('heading', { name: 'Welcome Back' })).toBeVisible();

    await signIn();

    expect(await screen.findByRole('heading', { name: 'Referral page' })).toBeVisible();
    expect(router.url).toBe('/referrals/req-abc');
  });

  it('ignores a returnUrl pointing at another origin', async () => {
    const { router, visit, signIn } = await setup();

    await visit('/sign-in?returnUrl=%2F%2Fevil.example%2Freferrals');
    await signIn();

    expect(await screen.findByRole('heading', { name: 'Membership' })).toBeVisible();
    expect(router.url).toBe('/membership');
  });
});
