import { canActivate, redirectLoggedInTo, redirectUnauthorizedTo } from '@angular/fire/auth-guard';
import { Routes } from '@angular/router';
import { AuthActions } from './auth-actions/auth-actions';
import { EditProfile } from './edit-profile/edit-profile';
import { EmailVerified } from './email-verified/email-verified';
import { FirebaseTest } from './firebase-test/firebase-test';
import { MyMembership } from './my-membership/my-membership';
import { SignIn } from './sign-in/sign-in';
import { SignUp } from './sign-up/sign-up';
import { VerifyEmail } from './verify-email/verify-email';

// Guards for different authentication states
const redirectUnauthorizedToSignIn = () => redirectUnauthorizedTo(['sign-in']);
const redirectToMembership = () => redirectLoggedInTo(['membership']);

export const routes: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'sign-in' },

  // Protected routes (require authentication and email verification)
  { path: 'membership', component: MyMembership, ...canActivate(redirectUnauthorizedToSignIn) },
  { path: 'profile', component: EditProfile, ...canActivate(redirectUnauthorizedToSignIn) },

  // Authentication routes
  { path: 'sign-up', component: SignUp, ...canActivate(redirectToMembership) },
  { path: 'sign-in', component: SignIn, ...canActivate(redirectToMembership) },
  { path: 'verify-email', component: EmailVerified, ...canActivate(redirectUnauthorizedToSignIn) },
  { path: 'check-email', component: VerifyEmail, ...canActivate(redirectUnauthorizedToSignIn) },

  // Firebase Auth action handler entry points
  { path: 'auth-actions', component: AuthActions },

  // Test routes
  { path: 'firebase-test', component: FirebaseTest },

  // future routes can go here
];
