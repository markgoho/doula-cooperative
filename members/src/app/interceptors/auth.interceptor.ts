import { type HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Auth } from '@angular/fire/auth';
import { from, switchMap } from 'rxjs';

/**
 * HTTP Interceptor that automatically adds Firebase Auth token to requests.
 *
 * Applies to all requests to `/api/admin/*` endpoints.
 * - Gets the current user's ID token from Firebase Auth
 * - Adds it as a Bearer token in the Authorization header
 * - If no user is authenticated, request proceeds without modification
 *
 * @example
 * // In app.config.ts
 * provideHttpClient(withInterceptors([authInterceptor]))
 *
 * // In services, no need to manually add headers:
 * this.httpClient.get('/api/admin/members/') // Token added automatically
 */
export const authInterceptor: HttpInterceptorFn = (request, next) => {
  const auth = inject(Auth);

  // Only intercept admin API requests
  if (!request.url.includes('/api/admin/')) {
    return next(request);
  }

  // Get ID token and add to request
  // eslint-disable-next-line unicorn/no-null
  return from(auth.currentUser?.getIdToken() ?? Promise.resolve(null)).pipe(
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
  );
};
