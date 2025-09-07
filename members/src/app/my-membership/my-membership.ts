import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
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

  protected readonly currentYear = new Date().getFullYear();

  // Expose the observable for use with async pipe in template
  protected user = toSignal(this.authService.user$);
  protected claimInProgress = signal(false);
  protected claimableProfileData = signal<{ name: string; subscriptionStart: Date } | undefined>(
    // eslint-disable-next-line unicorn/no-useless-undefined
    undefined,
  );

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

  protected async onSignOut() {
    try {
      await this.authService.signOut();
    } catch (error: unknown) {
      console.error('Sign out failed:', error);
    }
  }
}
