import { canActivate, redirectLoggedInTo, redirectUnauthorizedTo } from '@angular/fire/auth-guard';
import { Routes } from '@angular/router';
import { AuthActions } from './auth-actions/auth-actions';
import { EditProfile } from './edit-profile/edit-profile';
import { redirectNonAdminToMembership } from './guards/admin.guard';
import { Membership } from './membership/membership';
import { SignIn } from './sign-in/sign-in';
import { SignUp } from './sign-up/sign-up';

// Guards for different authentication states
const redirectUnauthorizedToSignIn = () => redirectUnauthorizedTo(['sign-in']);
const redirectToMembership = () => redirectLoggedInTo(['membership']);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'sign-in' },

  // Protected routes (require authentication and email verification)
  { path: 'membership', component: Membership, ...canActivate(redirectUnauthorizedToSignIn) },
  { path: 'profile', component: EditProfile, ...canActivate(redirectUnauthorizedToSignIn) },

  // Admin routes (require authentication and admin claim)
  {
    path: 'admin',
    ...canActivate(redirectNonAdminToMembership),
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      {
        path: 'users',
        loadComponent: () => import('./admin/users/admin-users').then((m) => m.AdminUsers),
      },
      {
        path: 'users/:uid',
        loadComponent: () => import('./admin/users/admin-user-detail').then((m) => m.AdminUserDetail),
      },
    ],
  },

  // Authentication routes
  { path: 'sign-up', component: SignUp, ...canActivate(redirectToMembership) },
  { path: 'sign-in', component: SignIn, ...canActivate(redirectToMembership) },

  // Firebase Auth action handler entry points
  { path: 'auth-actions', component: AuthActions },

  // future routes can go here
];
