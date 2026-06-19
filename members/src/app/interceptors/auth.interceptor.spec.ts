import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { describe, expect, it, vi } from 'vitest';
import { authInterceptor } from './auth.interceptor';

interface MockUser {
  uid: string;
  getIdToken: () => Promise<string>;
}

// The Angular unit-test system disallows vi.mock on relative imports, so we
// mock at the firebase SDK boundary instead: getAuth returns our controllable
// auth object, which lib/firebase then exports as the shared `auth` singleton.
const { mockAuth, mockSignOut } = vi.hoisted(() => ({
  mockAuth: { currentUser: undefined as MockUser | undefined },
  mockSignOut: vi.fn<() => Promise<void>>(() => Promise.resolve()),
}));

vi.mock('firebase/app', () => ({ initializeApp: vi.fn(() => ({})) }));
vi.mock('firebase/auth', () => ({
  getAuth: () => mockAuth,
  connectAuthEmulator: vi.fn(),
  signOut: mockSignOut,
}));

// Lets the interceptor's async token fetch / sign-out microtasks settle.
const flushMicrotasks = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('authInterceptor', () => {
  it('attaches a Bearer token to authenticated API requests', async () => {
    const { httpClient, httpTesting } = setup({
      currentUser: { uid: 'u1', getIdToken: () => Promise.resolve('test-token') },
    });

    httpClient.get('/api/members/u1').subscribe();
    await flushMicrotasks();

    const request = httpTesting.expectOne('/api/members/u1');
    expect(request.request.headers.get('Authorization')).toBe('Bearer test-token');
    request.flush({});
  });

  it('leaves the request unmodified when no user is authenticated', async () => {
    const { httpClient, httpTesting } = setup();

    httpClient.get('/api/members/u1').subscribe();
    await flushMicrotasks();

    const request = httpTesting.expectOne('/api/members/u1');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });

  it('does not touch requests to non-authenticated paths', async () => {
    const getIdToken = vi.fn();
    const { httpClient, httpTesting } = setup({ currentUser: { uid: 'u1', getIdToken } });

    httpClient.get('/public/config').subscribe();
    await flushMicrotasks();

    const request = httpTesting.expectOne('/public/config');
    expect(request.request.headers.has('Authorization')).toBe(false);
    expect(getIdToken).not.toHaveBeenCalled();
    request.flush({});
  });

  it('signs out and redirects to sign-in on a 401 response', async () => {
    const { httpClient, httpTesting, navigateSpy } = setup({
      currentUser: { uid: 'u1', getIdToken: () => Promise.resolve('test-token') },
    });

    httpClient.get('/api/members/u1').subscribe({ error: vi.fn() });
    await flushMicrotasks();

    httpTesting
      .expectOne('/api/members/u1')
      .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();

    expect(mockSignOut).toHaveBeenCalledOnce();
    expect(navigateSpy).toHaveBeenCalledWith(['/sign-in']);
  });

  it('still redirects to sign-in when sign-out fails after a 401', async () => {
    const { httpClient, httpTesting, navigateSpy } = setup({
      currentUser: { uid: 'u1', getIdToken: () => Promise.resolve('test-token') },
      signOutError: new Error('sign-out failed'),
    });

    httpClient.get('/api/members/u1').subscribe({ error: vi.fn() });
    await flushMicrotasks();

    httpTesting
      .expectOne('/api/members/u1')
      .flush('unauthorized', { status: 401, statusText: 'Unauthorized' });
    await flushMicrotasks();

    expect(navigateSpy).toHaveBeenCalledWith(['/sign-in']);
  });

  it('rethrows non-401 errors without signing out', async () => {
    const { httpClient, httpTesting } = setup({
      currentUser: { uid: 'u1', getIdToken: () => Promise.resolve('test-token') },
    });
    const errorHandler = vi.fn();

    httpClient.get('/api/members/u1').subscribe({ error: errorHandler });
    await flushMicrotasks();

    httpTesting
      .expectOne('/api/members/u1')
      .flush('server error', { status: 500, statusText: 'Server Error' });
    await flushMicrotasks();

    expect(errorHandler).toHaveBeenCalledOnce();
    expect(mockSignOut).not.toHaveBeenCalled();
  });

  it('proceeds without a token when token acquisition fails', async () => {
    const { httpClient, httpTesting } = setup({
      currentUser: {
        uid: 'u1',
        getIdToken: () => Promise.reject(new Error('network-request-failed')),
      },
    });

    httpClient.get('/api/members/u1').subscribe();
    await flushMicrotasks();

    const request = httpTesting.expectOne('/api/members/u1');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({});
  });
});

interface SetupOptions {
  currentUser?: MockUser;
  signOutError?: Error;
}

function setup({ currentUser, signOutError }: SetupOptions = {}) {
  vi.spyOn(console, 'error').mockReturnValue(undefined);

  mockAuth.currentUser = currentUser;
  mockSignOut.mockReset();
  mockSignOut.mockImplementation(() =>
    signOutError ? Promise.reject(signOutError) : Promise.resolve(),
  );

  TestBed.configureTestingModule({
    providers: [
      provideHttpClient(withInterceptors([authInterceptor])),
      provideHttpClientTesting(),
      provideRouter([]),
    ],
  });

  const httpClient = TestBed.inject(HttpClient);
  const httpTesting = TestBed.inject(HttpTestingController);
  const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigate').mockResolvedValue(true);

  return { httpClient, httpTesting, navigateSpy };
}
