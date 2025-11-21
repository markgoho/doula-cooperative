import { canActivate, redirectLoggedInTo, redirectUnauthorizedTo } from '@angular/fire/auth-guard';
import { type Routes } from '@angular/router';
import { redirectNonAdminToMembership } from './guards/admin.guard';

// Guards for different authentication states
const redirectUnauthorizedToSignIn = () => redirectUnauthorizedTo(['sign-in']);
const redirectToMembership = () => redirectLoggedInTo(['membership']);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'sign-in' },

  // Protected routes (require authentication and email verification)
  {
    path: 'membership',
    loadComponent: () => import('./membership/membership').then((m) => m.Membership),
    ...canActivate(redirectUnauthorizedToSignIn),
  },
  {
    path: 'profile',
    loadComponent: () => import('./edit-profile/edit-profile').then((m) => m.EditProfile),
    ...canActivate(redirectUnauthorizedToSignIn),
  },

  // Admin routes (require authentication and admin claim)
  {
    path: 'admin',
    ...canActivate(redirectNonAdminToMembership),
    children: [
      { path: '', redirectTo: 'users', pathMatch: 'full' },
      {
        path: 'users',
        loadComponent: () => import('./admin/users/admin-users/admin-users').then((m) => m.AdminUsers),
      },
      {
        path: 'users/member/:uid',
        loadComponent: () =>
          import('./admin/users/admin-member-detail/admin-member-detail').then((m) => m.AdminMemberDetail),
      },
      {
        path: 'users/unclaimed/:email',
        loadComponent: () =>
          import('./admin/users/admin-unclaimed-profile-detail/admin-unclaimed-profile-detail').then(
            (m) => m.AdminUnclaimedProfileDetail,
          ),
      },
    ],
  },

  // Authentication routes
  {
    path: 'sign-up',
    loadComponent: () => import('./sign-up/sign-up').then((m) => m.SignUp),
    ...canActivate(redirectToMembership),
  },
  {
    path: 'sign-in',
    loadComponent: () => import('./sign-in/sign-in').then((m) => m.SignIn),
    ...canActivate(redirectToMembership),
  },

  // Firebase Auth action handler entry points
  {
    path: 'auth-actions',
    loadComponent: () => import('./auth-actions/auth-actions').then((m) => m.AuthActions),
  },

  // future routes can go here
];
