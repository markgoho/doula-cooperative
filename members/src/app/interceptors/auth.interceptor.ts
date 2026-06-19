import { type HttpErrorResponse, type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { signOut } from 'firebase/auth';
import { Router } from '@angular/router';
import { EMPTY, catchError, from, of, switchMap } from 'rxjs';
import { auth } from '../lib/firebase';

/**
 * API paths that require authentication.
 * Add new authenticated API paths here to automatically include auth tokens.
 */
const AUTHENTICATED_API_PATHS = ['/api/admin/', '/api/analytics/', '/api/profiles/', '/api/members/'];

/**
 * HTTP Interceptor that manages Firebase Auth tokens on API requests.
 *
 * Applies to all requests matching paths in AUTHENTICATED_API_PATHS.
 * - Gets the current user's ID token from Firebase Auth
 * - Adds it as a Bearer token in the Authorization header
 * - If no user is authenticated, request proceeds without modification
 * - On 401 responses, signs the user out and redirects to /sign-in
 *
 * @example
 * // In app.config.ts
 * provideHttpClient(withInterceptors([authInterceptor]))
 *
 * // In services, no need to manually add headers:
 * this.httpClient.get('/api/admin/members/') // Token added automatically
 * this.httpClient.get('/api/profiles/me') // Token added automatically
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const router = inject(Router);

  // Only intercept authenticated API requests
  const requiresAuth = AUTHENTICATED_API_PATHS.some((path) => request.url.includes(path));
  if (!requiresAuth) {
    return next(request);
  }

  // Get ID token and add to request
  // eslint-disable-next-line unicorn/no-null
  return from(auth.currentUser?.getIdToken() ?? Promise.resolve(null)).pipe(
    catchError((tokenError: unknown) => {
      // Token acquisition failed (e.g. network error, revoked/expired token).
      // This is NOT an HttpErrorResponse, so handle it separately from the
      // response-error branch below. Proceed without a token; the server will
      // respond 401 if auth is required, which the 401 handler then catches.
      console.error('Failed to acquire auth token for request:', {
        url: request.url,
        error: tokenError instanceof Error ? tokenError.message : String(tokenError),
      });
      // eslint-disable-next-line unicorn/no-null
      return of(null);
    }),
    switchMap((token) => {
      if (!token) {
        // No user authenticated - proceed without modification
        return next(request);
      }

      // Clone request and add Authorization header
      const authRequest = request.clone({
        setHeaders: {
          Authorization: `Bearer ${token}`,
        },
      });

      return next(authRequest);
    }),
    catchError((error: HttpErrorResponse) => {
      if (error.status === 401) {
        // Token is invalid/revoked — sign out and redirect to sign-in
        signOut(auth).then(
          () => void router.navigate(['/sign-in']),
          (signOutError: unknown) => {
            console.error('Sign out after 401 failed:', signOutError);
            void router.navigate(['/sign-in']);
          },
        );
        return EMPTY;
      }
      throw error;
    }),
  );
};
