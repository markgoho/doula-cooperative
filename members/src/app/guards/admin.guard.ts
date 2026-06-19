import { inject } from '@angular/core';
import { Router, type CanActivateFn } from '@angular/router';
import { getIdTokenResult } from 'firebase/auth';
import { auth } from '../lib/firebase';

export const redirectNonAdminToMembership: CanActivateFn = async () => {
  const router = inject(Router);
  const user = auth.currentUser;
  if (!user) return router.parseUrl('/sign-in');
  const result = await getIdTokenResult(user);
  return result.claims['admin'] === true || router.parseUrl('/membership');
};
