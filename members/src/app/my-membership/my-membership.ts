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

  protected async onSignOut() {
    try {
      await this.authService.signOut();
    } catch (error: unknown) {
      console.error('Sign out failed:', error);
    }
  }
}
