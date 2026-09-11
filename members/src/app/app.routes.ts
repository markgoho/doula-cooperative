import { inject } from '@angular/core';
import { Router, type CanActivateFn, type Routes } from '@angular/router';
import { wizardStepGuard } from './create-profile-wizard/guards/wizard-step.guard';
import { auth } from './lib/firebase';

export const requireAuth: CanActivateFn = async () => {
  const router = inject(Router);
  // Wait for Firebase to restore any persisted session before deciding, so a
  // hard refresh on a protected route doesn't bounce an authenticated user.
  await auth.authStateReady();
  return auth.currentUser ? true : router.parseUrl('/sign-in');
};

export const requireUnauth: CanActivateFn = async () => {
  const router = inject(Router);
  await auth.authStateReady();
  return auth.currentUser ? router.parseUrl('/membership') : true;
};

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'sign-in' },

  // Protected routes (require authentication and email verification)
  {
    path: 'membership',
    loadComponent: () => import('./membership/membership').then((m) => m.Membership),
    canActivate: [requireAuth],
  },
  {
    path: 'profile/create',
    canActivate: [requireAuth],
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
    canActivate: [requireAuth],
  },
  {
    path: 'profile',
    loadComponent: () => import('./edit-profile/edit-profile').then((m) => m.EditProfile),
    canActivate: [requireAuth],
  },
  {
    path: 'profile/image',
    loadComponent: () =>
      import('./edit-profile-image/edit-profile-image').then((m) => m.EditProfileImage),
    canActivate: [requireAuth],
  },

  // Member referral routes (require authentication)
  {
    path: 'referrals',
    loadComponent: () => import('./referrals/referrals').then((m) => m.Referrals),
    canActivate: [requireAuth],
  },
  {
    path: 'referrals/:id',
    loadComponent: () =>
      import('./referrals/referral-detail/referral-detail').then((m) => m.ReferralDetail),
    canActivate: [requireAuth],
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
    canActivate: [requireUnauth],
  },
  {
    path: 'forgot-password',
    loadComponent: () => import('./forgot-password/forgot-password').then((m) => m.ForgotPassword),
    canActivate: [requireUnauth],
  },
  {
    path: 'change-email',
    loadComponent: () => import('./change-email/change-email').then((m) => m.ChangeEmail),
    canActivate: [requireAuth],
  },

  // Firebase Auth action handler entry points
  {
    path: 'auth-actions',
    loadComponent: () => import('./auth-actions/auth-actions').then((m) => m.AuthActions),
  },
];
