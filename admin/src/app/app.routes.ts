import { type Routes } from '@angular/router';
import { requireAdminAuth, requireAdminUnauth } from './guards/admin-auth.guard';

export const routes: Routes = [
  // Dashboard at root
  {
    path: '',
    pathMatch: 'full',
    canActivate: [requireAdminAuth],
    loadComponent: () => import('./admin/admin-dashboard').then((m) => m.AdminDashboard),
  },

  // Members routes
  {
    path: 'members',
    canActivate: [requireAdminAuth],
    children: [
      {
        path: '',
        loadComponent: () => import('./admin/members/admin-members').then((m) => m.AdminMembers),
      },
      {
        path: ':uid',
        loadComponent: () =>
          import('./admin/users/admin-member-detail/admin-member-detail').then(
            (m) => m.AdminMemberDetail,
          ),
      },
      {
        path: ':uid/profile',
        loadComponent: () =>
          import('./admin/users/admin-profile-preview/admin-profile-preview').then(
            (m) => m.AdminProfilePreview,
          ),
      },
      {
        path: ':uid/profile/edit',
        loadComponent: () =>
          import('./admin/users/admin-edit-profile/admin-edit-profile').then(
            (m) => m.AdminEditProfile,
          ),
      },
    ],
  },

  // Unclaimed profiles
  {
    path: 'unclaimed',
    canActivate: [requireAdminAuth],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./admin/unclaimed/admin-unclaimed').then((m) => m.AdminUnclaimed),
      },
      {
        path: ':email',
        loadComponent: () =>
          import('./admin/users/admin-unclaimed-profile-detail/admin-unclaimed-profile-detail').then(
            (m) => m.AdminUnclaimedProfileDetail,
          ),
      },
    ],
  },

  // Match requests
  {
    path: 'match-requests',
    canActivate: [requireAdminAuth],
    children: [
      {
        path: '',
        loadComponent: () =>
          import('./admin/match-requests/admin-match-requests').then((m) => m.AdminMatchRequests),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./admin/match-requests/admin-match-request-detail/admin-match-request-detail').then(
            (m) => m.AdminMatchRequestDetail,
          ),
      },
    ],
  },

  // Analytics
  {
    path: 'analytics',
    canActivate: [requireAdminAuth],
    loadComponent: () => import('./admin/analytics/admin-analytics').then((m) => m.AdminAnalytics),
  },

  // Messages
  {
    path: 'messages',
    canActivate: [requireAdminAuth],
    children: [
      {
        path: '',
        loadComponent: () => import('./admin/messages/admin-messages').then((m) => m.AdminMessages),
      },
      {
        path: ':id',
        loadComponent: () =>
          import('./admin/messages/admin-message-detail/admin-message-detail').then(
            (m) => m.AdminMessageDetail,
          ),
      },
    ],
  },

  // Auth routes
  {
    path: 'sign-in',
    canActivate: [requireAdminUnauth],
    loadComponent: () => import('./sign-in/sign-in').then((m) => m.SignIn),
  },
  {
    path: 'forgot-password',
    canActivate: [requireAdminUnauth],
    loadComponent: () => import('./forgot-password/forgot-password').then((m) => m.ForgotPassword),
  },

  // Backward-compatibility redirects for /admin/* paths
  { path: 'admin', pathMatch: 'full', redirectTo: '' },
  { path: 'admin/members', redirectTo: 'members' },
  { path: 'admin/members/:uid', redirectTo: 'members/:uid' },
  { path: 'admin/members/:uid/profile', redirectTo: 'members/:uid/profile' },
  { path: 'admin/members/:uid/profile/edit', redirectTo: 'members/:uid/profile/edit' },
  { path: 'admin/unclaimed', redirectTo: 'unclaimed' },
  { path: 'admin/unclaimed/:email', redirectTo: 'unclaimed/:email' },
  { path: 'admin/match-requests', redirectTo: 'match-requests' },
  { path: 'admin/match-requests/:id', redirectTo: 'match-requests/:id' },
  { path: 'admin/analytics', redirectTo: 'analytics' },
  { path: 'admin/messages', redirectTo: 'messages' },
  { path: 'admin/messages/:id', redirectTo: 'messages/:id' },

  // Catch-all redirect
  { path: '**', redirectTo: '' },
];
