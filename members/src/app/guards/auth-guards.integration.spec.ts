import { ChangeDetectionStrategy, Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, type Routes, RouterOutlet, provideRouter } from '@angular/router';
import { render, screen } from '@testing-library/angular/zoneless';
import { describe, expect, it, vi } from 'vitest';
import { requireAuth, requireUnauth } from '../app.routes';
import { redirectNonAdminToMembership } from './admin.guard';

// The Angular unit-test system disallows vi.mock on relative imports, so we
// mock at the firebase SDK boundary instead: getAuth returns our controllable
// auth object, which lib/firebase then exports as the shared `auth` singleton.
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

@Component({ template: '<h1>Sign In</h1>', changeDetection: ChangeDetectionStrategy.OnPush })
class MockSignIn {}

@Component({ template: '<h1>Membership</h1>', changeDetection: ChangeDetectionStrategy.OnPush })
class MockMembership {}

@Component({ template: '<h1>Protected</h1>', changeDetection: ChangeDetectionStrategy.OnPush })
class MockProtected {}

@Component({ template: '<h1>Admin</h1>', changeDetection: ChangeDetectionStrategy.OnPush })
class MockAdmin {}

@Component({
  template: '<router-outlet></router-outlet>',
  imports: [RouterOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
class MockApp {}

const routes: Routes = [
  { path: 'sign-in', component: MockSignIn },
  { path: 'membership', component: MockMembership },
  { path: 'protected', component: MockProtected, canActivate: [requireAuth] },
  { path: 'guest-only', component: MockSignIn, canActivate: [requireUnauth] },
  { path: 'admin', component: MockAdmin, canActivate: [redirectNonAdminToMembership] },
];

describe('auth route guards', () => {
  describe('requireAuth', () => {
    it('redirects an unauthenticated user to sign-in', async () => {
      const { navigate } = await setup();
      await navigate('/protected');
      expect(screen.getByText('Sign In')).toBeVisible();
    });

    it('allows an authenticated user through', async () => {
      const { navigate } = await setup({ currentUser: { uid: 'user-1' } });
      await navigate('/protected');
      expect(screen.getByText('Protected')).toBeVisible();
    });

    it('waits for authStateReady before reading currentUser', async () => {
      // currentUser is only populated once the persisted session is restored,
      // which the guard must await before deciding.
      const { navigate } = await setup({
        authStateReady: (auth) =>
          new Promise<void>((resolve) => {
            auth.currentUser = { uid: 'restored' };
            resolve();
          }),
      });
      await navigate('/protected');
      expect(screen.getByText('Protected')).toBeVisible();
    });
  });

  describe('requireUnauth', () => {
    it('redirects an authenticated user to membership', async () => {
      const { navigate } = await setup({ currentUser: { uid: 'user-1' } });
      await navigate('/guest-only');
      expect(screen.getByText('Membership')).toBeVisible();
    });

    it('allows an unauthenticated user to reach the guest-only page', async () => {
      const { navigate } = await setup();
      await navigate('/guest-only');
      expect(screen.getByText('Sign In')).toBeVisible();
    });
  });

  describe('redirectNonAdminToMembership', () => {
    it('redirects to sign-in when there is no user', async () => {
      const { navigate } = await setup();
      await navigate('/admin');
      expect(screen.getByText('Sign In')).toBeVisible();
    });

    it('allows a user with the admin claim', async () => {
      const { navigate } = await setup({
        currentUser: { uid: 'admin-1' },
        idTokenResult: { claims: { admin: true } },
      });
      await navigate('/admin');
      expect(screen.getByText('Admin')).toBeVisible();
    });

    it('redirects a non-admin to membership', async () => {
      const { navigate } = await setup({
        currentUser: { uid: 'user-1' },
        idTokenResult: { claims: { admin: false } },
      });
      await navigate('/admin');
      expect(screen.getByText('Membership')).toBeVisible();
    });

    it('treats a non-boolean admin claim as non-admin', async () => {
      const { navigate } = await setup({
        currentUser: { uid: 'user-1' },
        idTokenResult: { claims: { admin: 'true' } },
      });
      await navigate('/admin');
      expect(screen.getByText('Membership')).toBeVisible();
    });

    it('fails closed to membership when the token check rejects', async () => {
      const { navigate } = await setup({
        currentUser: { uid: 'user-1' },
        idTokenError: new Error('network-request-failed'),
      });
      await navigate('/admin');
      expect(screen.getByText('Membership')).toBeVisible();
    });
  });
});

interface SetupOptions {
  currentUser?: { uid: string } | null;
  authStateReady?: (auth: typeof mockAuth) => Promise<void>;
  idTokenResult?: { claims: Record<string, unknown> };
  idTokenError?: Error;
}

async function setup({
  currentUser,
  authStateReady,
  idTokenResult,
  idTokenError,
}: SetupOptions = {}) {
  vi.spyOn(console, 'error').mockReturnValue(undefined);

  mockAuth.currentUser = currentUser;
  mockAuth.authStateReady = vi.fn(() =>
    authStateReady ? authStateReady(mockAuth) : Promise.resolve(),
  );

  mockGetIdTokenResult.mockReset();
  if (idTokenError) {
    mockGetIdTokenResult.mockRejectedValue(idTokenError);
  } else if (idTokenResult) {
    mockGetIdTokenResult.mockResolvedValue(idTokenResult);
  }

  await render(MockApp, { providers: [provideRouter(routes)] });

  const router = TestBed.inject(Router);
  const navigate = async (path: string) => {
    await router.navigateByUrl(path);
  };

  return { navigate };
}
