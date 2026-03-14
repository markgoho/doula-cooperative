import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  inject,
  signal,
  viewChild,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { MembershipService } from '../services/membership.service';
import { ConfirmDialog } from '../shared/confirm-dialog/confirm-dialog';
import { FACEBOOK_GROUP_URL } from '../constants/urls';
import { ensureUniqueSlug, generateSlug } from '../utils/slug-generator';

@Component({
  imports: [DatePipe, FormsModule, ConfirmDialog],
  templateUrl: './membership.html',
  styleUrl: './membership.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Membership {
  private authService = inject(AuthService);
  private membershipService = inject(MembershipService);
  private router = inject(Router);

  protected readonly facebookGroupUrl = FACEBOOK_GROUP_URL;

  protected user = this.authService.user;
  protected createProfileInProgress = signal(false);
  protected createProfileError = signal<string | undefined>(undefined);
  protected newsletterUpdateInProgress = signal(false);
  protected newsletterUpdateError = signal<string | undefined>(undefined);
  protected nameInput = signal('');
  protected nameUpdateInProgress = signal(false);
  protected nameUpdateError = signal<string | undefined>(undefined);

  protected userDocument = this.membershipService.userDocument;
  protected userDocumentResource = this.membershipService.userDocumentResource;

  // Error message for user document loading failures
  protected userDocumentError = computed(() => {
    const error = this.userDocumentResource.error();
    return error
      ? 'Unable to load your account details. Please try refreshing the page.'
      : undefined;
  });

  // Name prompt and profile creation banner are mutually exclusive:
  // the name prompt appears first; once the member sets their name,
  // the profile creation banner takes its place.
  protected showCreateProfileBanner = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.membershipActive && !userDocument?.slug && !!userDocument?.name;
  });

  // Show welcome prompt for active members who need to set their name
  // before they can create a profile (profile creation requires a name to generate a slug)
  protected showWelcomeNamePrompt = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.membershipActive && !userDocument?.slug && !userDocument?.name;
  });

  // Computed signals for formatted user data
  protected membershipCreated = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.createdAt;
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
    return userDocument?.subscriptionStart;
  });

  protected lastPaymentDate = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.lastPayment;
  });

  protected nextPaymentDate = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.nextPayment;
  });

  protected membershipExpiresDate = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.membershipExpiresAt;
  });

  protected newsletterSubscribed = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.newsletterSubscribed ?? false;
  });

  protected isRefunded = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.subscriptionStatus === 'refunded';
  });

  protected isCanceled = computed(() => {
    const userDocument = this.userDocument();
    return userDocument?.subscriptionStatus === 'canceled';
  });

  protected canCancelMembership = computed(() => {
    const userDocument = this.userDocument();
    return (
      userDocument?.membershipActive &&
      userDocument?.stripeCustomerId !== undefined &&
      userDocument?.stripeSubscriptionId !== undefined &&
      userDocument?.subscriptionStatus !== 'canceled' &&
      userDocument?.subscriptionStatus !== 'refunded'
    );
  });

  protected cancelInProgress = signal(false);
  protected cancelError = signal<string | undefined>(undefined);

  protected confirmDialog = viewChild(ConfirmDialog);

  protected async onUpdateNewsletterPreference(subscribed: boolean) {
    this.newsletterUpdateInProgress.set(true);
    this.newsletterUpdateError.set(undefined);

    try {
      await this.membershipService.updateNewsletterPreference(subscribed);
      // Resource will auto-reload via reloadUserDocument() in service
    } catch (error) {
      console.error('Error updating newsletter preference:', error);
      const errorMessage =
        error instanceof Error
          ? error.message
          : 'Failed to update newsletter preference. Please try again.';
      this.newsletterUpdateError.set(errorMessage);
    } finally {
      this.newsletterUpdateInProgress.set(false);
    }
  }

  protected async onCreateProfile() {
    this.createProfileInProgress.set(true);
    this.createProfileError.set(undefined);

    try {
      const userDocument = this.userDocument();
      if (!userDocument?.name) {
        throw new Error('Name is required to create profile');
      }

      // Generate slug from name
      const baseSlug = generateSlug(userDocument.name);
      let uniqueSlug: string;

      try {
        uniqueSlug = await ensureUniqueSlug(baseSlug, (slug) =>
          this.membershipService.checkSlugExists(slug),
        );
      } catch (error) {
        console.error('Slug generation failed:', error);
        throw new Error(
          'Unable to generate a unique profile URL. Please try again or contact support.',
        );
      }

      // Update Firestore with slug
      try {
        await this.membershipService.updateMemberSlug(uniqueSlug);
      } catch (error) {
        console.error('Failed to save profile slug:', error);
        // Re-throw with the error message from the service (which has better context)
        throw error;
      }

      // Navigate to create profile page
      await this.router.navigate(['/profile/create']);
    } catch (error) {
      console.error('Error creating profile:', error);

      // Use the error message if it's already user-friendly
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to create profile. Please try again.';

      this.createProfileError.set(errorMessage);
    } finally {
      this.createProfileInProgress.set(false);
    }
  }

  protected async onSaveName() {
    const name = this.nameInput().trim();
    if (name.length === 0) {
      return;
    }

    this.nameUpdateInProgress.set(true);
    this.nameUpdateError.set(undefined);

    try {
      await this.membershipService.updateMemberName(name);
      // Resource will auto-reload via reloadUserDocument() in service
    } catch (error) {
      console.error('Error updating name:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to save your name. Please try again.';
      this.nameUpdateError.set(errorMessage);
    } finally {
      this.nameUpdateInProgress.set(false);
    }
  }

  protected showCancelConfirm(): void {
    this.confirmDialog()?.showModal();
  }

  protected onCancelDialog(): void {
    this.confirmDialog()?.close();
  }

  protected async onConfirmCancel(): Promise<void> {
    this.cancelInProgress.set(true);
    this.cancelError.set(undefined);

    try {
      await this.membershipService.cancelMembership();
      this.confirmDialog()?.close();
    } catch (error) {
      console.error('Error canceling membership:', error);
      const errorMessage =
        error instanceof Error ? error.message : 'Failed to cancel membership. Please try again.';
      this.cancelError.set(errorMessage);
    } finally {
      this.cancelInProgress.set(false);
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
