import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';

@Component({
  imports: [DatePipe],
  templateUrl: './my-membership.html',
  styleUrl: './my-membership.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyMembership {
  private authService = inject(AuthService);
  private membershipService = inject(MembershipService);

  protected user = this.authService.user;
  protected claimInProgress = signal(false);
  protected claimableProfileData = signal<{ name: string; subscriptionStart: Date } | undefined>(
    // eslint-disable-next-line unicorn/no-useless-undefined
    undefined,
  );

  protected emailVerified = computed(() => this.user()?.emailVerified ?? false);

  // Email verification related signals
  protected emailVerificationResendInProgress = signal(false);
  protected emailVerificationError = signal('');
  protected emailVerificationSuccess = signal('');

  protected userDocument = this.membershipService.userDocument;

  // Computed signals for formatted user data
  protected membershipCreated = computed(() => {
    const userDocument = this.userDocument();
    if (userDocument?.createdAt) {
      return userDocument.createdAt.toDate();
    }
    return;
  });

  protected userFullName = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.name;
  });

  protected userDisplayName = computed(() => {
    const user = this.user();
    return user?.displayName ?? user?.email ?? 'User';
  });

  protected subscriptionStarted = computed(() => {
    const userDocument = this.userDocument();
    if (userDocument?.subscriptionStart) {
      return userDocument.subscriptionStart.toDate();
    }
    return;
  });

  constructor() {
    effect(() => {
      // When the user signal changes, trigger the check for a claimable profile.
      // We wrap the async logic in a void call to satisfy the effect's synchronous nature.
      void this.checkForClaimableProfile();
    });
  }

  private async checkForClaimableProfile(): Promise<void> {
    const currentUser = this.user();
    const profileData = await this.membershipService.getClaimableProfileData(currentUser);
    this.claimableProfileData.set(profileData);
  }

  protected async onClaimProfile() {
    this.claimInProgress.set(true);
    try {
      await this.authService.claimProfile();
      this.claimableProfileData.set(undefined); // Hide the banner after claiming
    } catch (error) {
      console.error('Failed to claim profile:', error);
      // TODO: Add proper error handling (toast notification, etc.)
    } finally {
      this.claimInProgress.set(false);
    }
  }

  protected async onResendVerificationEmail() {
    this.emailVerificationResendInProgress.set(true);
    this.emailVerificationError.set('');
    this.emailVerificationSuccess.set('');

    try {
      await this.authService.resendEmailVerification();
      this.emailVerificationSuccess.set('Verification email sent! Please check your inbox.');
    } catch (error) {
      console.error('Failed to resend verification email:', error);
      this.emailVerificationError.set('Failed to send verification email. Please try again.');
    } finally {
      this.emailVerificationResendInProgress.set(false);
    }
  }

  protected async onSignOut() {
    try {
      await this.authService.signOut();
    } catch (error: unknown) {
      console.error('Sign out failed:', error);
    }
  }
}
