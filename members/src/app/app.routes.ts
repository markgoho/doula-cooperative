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
    path: 'profile/create',
    loadComponent: () => import('./create-profile/create-profile').then((m) => m.CreateProfile),
    ...canActivate(redirectUnauthorizedToSignIn),
  },
  {
    path: 'profile',
    loadComponent: () => import('./edit-profile/edit-profile').then((m) => m.EditProfile),
    ...canActivate(redirectUnauthorizedToSignIn),
  },
  {
    path: 'profile/image',
    loadComponent: () =>
      import('./edit-profile-image/edit-profile-image').then((m) => m.EditProfileImage),
    ...canActivate(redirectUnauthorizedToSignIn),
  },

  // Admin routes (require authentication and admin claim)
  {
    path: 'admin',
    ...canActivate(redirectNonAdminToMembership),
    children: [
      {
        path: '',
        loadComponent: () => import('./admin/admin-dashboard').then((m) => m.AdminDashboard),
      },
      {
        path: 'members',
        loadComponent: () =>
          import('./admin/members/admin-members').then((m) => m.AdminMembers),
      },
      {
        path: 'members/:uid',
        loadComponent: () =>
          import('./admin/users/admin-member-detail/admin-member-detail').then(
            (m) => m.AdminMemberDetail,
          ),
      },
      {
        path: 'unclaimed',
        loadComponent: () =>
          import('./admin/unclaimed/admin-unclaimed').then((m) => m.AdminUnclaimed),
      },
      {
        path: 'unclaimed/:email',
        loadComponent: () =>
          import('./admin/users/admin-unclaimed-profile-detail/admin-unclaimed-profile-detail').then(
            (m) => m.AdminUnclaimedProfileDetail,
          ),
      },
      {
        path: 'match-requests',
        loadComponent: () =>
          import('./admin/match-requests/admin-match-requests').then((m) => m.AdminMatchRequests),
      },
      {
        path: 'match-requests/:id',
        loadComponent: () =>
          import('./admin/match-requests/admin-match-request-detail/admin-match-request-detail').then(
            (m) => m.AdminMatchRequestDetail,
          ),
      },
      {
        path: 'messages',
        loadComponent: () => import('./admin/messages/admin-messages').then((m) => m.AdminMessages),
      },
      {
        path: 'messages/:id',
        loadComponent: () =>
          import('./admin/messages/admin-message-detail/admin-message-detail').then(
            (m) => m.AdminMessageDetail,
          ),
      },
    ],
  },

  // Authentication routes
  // Redirect sign-up attempts to sign-in with helpful message
  {
    path: 'sign-up',
    redirectTo: () => '/sign-in?message=signup-disabled',
  },
  {
    path: 'sign-in',
    loadComponent: () => import('./sign-in/sign-in').then((m) => m.SignIn),
    ...canActivate(redirectToMembership),
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password/forgot-password').then((m) => m.ForgotPassword),
    ...canActivate(redirectToMembership),
  },

  // Firebase Auth action handler entry points
  {
    path: 'auth-actions',
    loadComponent: () => import('./auth-actions/auth-actions').then((m) => m.AuthActions),
  },

  // future routes can go here
];
