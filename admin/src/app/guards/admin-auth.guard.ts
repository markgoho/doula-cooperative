import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { getIdTokenResult } from 'firebase/auth';
import { auth } from '../lib/firebase';

export const requireAdminAuth: CanActivateFn = async () => {
  const router = inject(Router);
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    return router.parseUrl('/sign-in');
  }

  try {
    const result = await getIdTokenResult(user);
    if (result.claims['admin'] === true) {
      return true;
    }
    return router.parseUrl('/sign-in?message=unauthorized');
  } catch (error) {
    console.error('Admin guard token check failed:', error);
    return router.parseUrl('/sign-in');
  }
};

export const requireAdminUnauth: CanActivateFn = async () => {
  const router = inject(Router);
  await auth.authStateReady();
  const user = auth.currentUser;
  if (!user) {
    return true;
  }

  try {
    const result = await getIdTokenResult(user);
    if (result.claims['admin'] === true) {
      return router.parseUrl('/');
    }
    return true;
  } catch {
    return true;
  }
};
