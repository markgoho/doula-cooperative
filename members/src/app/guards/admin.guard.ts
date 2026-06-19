import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { getIdTokenResult } from 'firebase/auth';
import { auth } from '../lib/firebase';

export const redirectNonAdminToMembership: CanActivateFn = async () => {
  const router = inject(Router);
  // Wait for the persisted session to load before reading currentUser.
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) return router.parseUrl('/sign-in');

  try {
    const result = await getIdTokenResult(user);
    return result.claims['admin'] === true || router.parseUrl('/membership');
  } catch (error) {
    // Token refresh can reject on network failure / revoked token. Fail closed:
    // never grant admin access on error, and surface the failure.
    console.error('Admin guard token check failed:', {
      uid: user.uid,
      error: error instanceof Error ? error.message : String(error),
      code: (error as { code?: string }).code,
    });
    return router.parseUrl('/membership');
  }
};
