import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  resource,
  signal,
} from '@angular/core';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';

@Component({
  imports: [DatePipe],
  templateUrl: './membership.html',
  styleUrl: './membership.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Membership {
  private authService = inject(AuthService);
  private membershipService = inject(MembershipService);

  protected user = this.authService.user;
  protected claimInProgress = signal(false);

  protected userDocument = this.membershipService.userDocument;

  // Resource automatically loads when user changes
  protected claimableProfileResource = resource({
    params: () => ({ user: this.user() }),
    loader: ({ params }) => this.membershipService.getClaimableProfileData(params.user),
  });

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

  protected lastPaymentDate = computed(() => {
    const userDocument = this.userDocument();
    if (userDocument?.lastPayment) {
      return userDocument.lastPayment.toDate();
    }
    return;
  });

  protected nextPaymentDate = computed(() => {
    const userDocument = this.userDocument();
    if (userDocument?.nextPayment) {
      return userDocument.nextPayment.toDate();
    }
    return;
  });

  protected membershipExpiresDate = computed(() => {
    const userDocument = this.userDocument();
    if (userDocument?.membershipExpiresAt) {
      return userDocument.membershipExpiresAt.toDate();
    }
    return;
  });

  protected async onClaimProfile() {
    this.claimInProgress.set(true);
    try {
      await this.authService.claimProfile();
      // Clear the banner after claiming
      this.claimableProfileResource.set(undefined);
    } catch (error) {
      console.error('Failed to claim profile:', error);
      // TODO: Add proper error handling (toast notification, etc.)
    } finally {
      this.claimInProgress.set(false);
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
