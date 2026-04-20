import { canActivate, redirectLoggedInTo, redirectUnauthorizedTo } from '@angular/fire/auth-guard';
import { type Routes } from '@angular/router';
import { redirectNonAdminToMembership } from './guards/admin.guard';
import { wizardStepGuard } from './create-profile-wizard/guards/wizard-step.guard';

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
    ...canActivate(redirectUnauthorizedToSignIn),
    loadComponent: () =>
      import('./create-profile-wizard/create-profile-wizard').then((m) => m.CreateProfileWizard),
    children: [
      { path: '', redirectTo: 'personal', pathMatch: 'full' },
      {
        path: 'personal',
        loadComponent: () =>
          import('./create-profile-wizard/steps/personal-info-step/personal-info-step').then(
            (m) => m.PersonalInfoStep,
          ),
      },
      {
        path: 'tags',
        loadComponent: () =>
          import('./create-profile-wizard/steps/tags-step/tags-step').then((m) => m.TagsStep),
        canActivate: [wizardStepGuard('tags')],
      },
      {
        path: 'bio',
        loadComponent: () =>
          import('./create-profile-wizard/steps/bio-step/bio-step').then((m) => m.BioStep),
        canActivate: [wizardStepGuard('bio')],
      },
      {
        path: 'contact',
        loadComponent: () =>
          import('./create-profile-wizard/steps/contact-step/contact-step').then(
            (m) => m.ContactStep,
          ),
        canActivate: [wizardStepGuard('contact')],
      },
      {
        path: 'image',
        loadComponent: () =>
          import('./create-profile-wizard/steps/image-step/image-step').then((m) => m.ImageStep),
        canActivate: [wizardStepGuard('image')],
      },
      {
        path: 'preview',
        loadComponent: () =>
          import('./create-profile-wizard/steps/preview-step/preview-step').then(
            (m) => m.PreviewStep,
          ),
        canActivate: [wizardStepGuard('preview')],
      },
    ],
  },
  {
    path: 'profile/preview',
    loadComponent: () =>
      import('./profile-preview-page/profile-preview-page').then((m) => m.ProfilePreviewPage),
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
        loadComponent: () => import('./admin/members/admin-members').then((m) => m.AdminMembers),
      },
      {
        path: 'members/:uid',
        loadComponent: () =>
          import('./admin/users/admin-member-detail/admin-member-detail').then(
            (m) => m.AdminMemberDetail,
          ),
      },
      {
        path: 'members/:uid/profile',
        loadComponent: () =>
          import('./admin/users/admin-profile-preview/admin-profile-preview').then(
            (m) => m.AdminProfilePreview,
          ),
      },
      {
        path: 'members/:uid/profile/edit',
        loadComponent: () =>
          import('./admin/users/admin-edit-profile/admin-edit-profile').then(
            (m) => m.AdminEditProfile,
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
  {
    path: 'change-email',
    loadComponent: () => import('./change-email/change-email').then((m) => m.ChangeEmail),
    ...canActivate(redirectUnauthorizedToSignIn),
  },

  // Firebase Auth action handler entry points
  {
    path: 'auth-actions',
    loadComponent: () => import('./auth-actions/auth-actions').then((m) => m.AuthActions),
  },

  // future routes can go here
];
