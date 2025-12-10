import { computed, inject, Injectable, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState, type User } from '@angular/fire/auth';
import { doc, Firestore, getDoc, Timestamp } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { isFirebaseFunctionsError } from '../types/firebase-error';

interface MigratedUserData {
  name: string;
  subscriptionStart: Timestamp;
  slug?: string;
  membershipActive?: boolean;
  membershipExpiresAt?: Timestamp;
  invitationEmailStatus?: 'sent' | 'failed' | 'pending';
  invitationEmailSentAt?: Timestamp;
  invitationEmailError?: string;
}

export interface UnclaimedProfile {
  name: string;
  subscriptionStart: Date;
  slug?: string;
}

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing'
  | 'unpaid';

export interface Member {
  createdAt: Timestamp;
  email: string;
  uid: string;
  name?: string;
  subscriptionStart?: Timestamp;
  membershipActive?: boolean;
  membershipExpiresAt?: Timestamp;
  slug?: string;
  profileCreatedAt?: Timestamp;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  lastPayment?: Timestamp;
  nextPayment?: Timestamp;
  newsletterSubscribed?: boolean;
  newsletterSubscribedAt?: Timestamp;
  newsletterUnsubscribedAt?: Timestamp;
}

@Injectable({
  providedIn: 'root',
})
export class MembershipService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private functions = inject(Functions);

  // Use authState directly to avoid circular dependency with AuthService
  private user$ = authState(this.auth);

  userId = computed(() => this.auth.currentUser?.uid ?? 'abcd');
  user = toSignal(this.user$);

  // Resource for loading user document - automatically reloads when user changes
  readonly userDocumentResource = resource({
    params: (): { uid: string } | undefined => {
      const user = this.user();
      return user?.uid ? { uid: user.uid } : undefined;
    },
    loader: async ({ params }): Promise<Member | undefined> => {
      const userDocumentReference = doc(this.firestore, `members/${params.uid}`);
      const snapshot = await getDoc(userDocumentReference);
      return snapshot.exists() ? (snapshot.data() as Member) : undefined;
    },
  });

  // Computed signal for easy access to user document value
  userDocument = computed((): Member | undefined => {
    if (this.userDocumentResource.hasValue()) {
      return this.userDocumentResource.value();
    }
    return undefined;
  });

  // Computed properties for easy access to specific member document fields
  membershipActive = computed(() => this.userDocument()?.membershipActive ?? false);
  hasProfile = computed(() => {
    return !!this.userDocument()?.profileCreatedAt;
  });

  async getClaimableProfileData(
    user: User | null | undefined,
  ): Promise<UnclaimedProfile | undefined> {
    if (user?.email && user.emailVerified) {
      const userDocumentReference = doc(this.firestore, `migrated_users_import/${user.email}`);
      const userDocument = await getDoc(userDocumentReference);

      if (userDocument.exists()) {
        const data = userDocument.data() as MigratedUserData;
        return {
          name: data.name,
          subscriptionStart: data.subscriptionStart.toDate(),
          ...(data.slug && { slug: data.slug }),
        };
      }
    }
    return undefined;
  }

  /**
   * Check if a slug is available (not taken by another member)
   * @param slug - The slug to check
   * @returns true if slug is already taken, false if available
   * @throws Error with user-friendly message
   */
  async checkSlugExists(slug: string): Promise<boolean> {
    const checkSlugCallable = httpsCallable<{ slug: string }, { available: boolean }>(
      this.functions,
      'checkSlugAvailable',
    );

    try {
      const result = await checkSlugCallable({ slug });
      return !result.data.available; // Returns true if slug EXISTS (taken)
    } catch (error: unknown) {
      console.error('Slug availability check failed:', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });

      if (isFirebaseFunctionsError(error)) {
        switch (error.code) {
          case 'unauthenticated': {
            throw new Error('You must be signed in to check slug availability.');
          }

          case 'deadline-exceeded': {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Unable to check slug availability. Please try again.');
    }
  }

  /**
   * Set the profile slug for the current user and reload user document
   * @param slug - The slug to set
   * @throws Error with user-friendly message
   */
  async updateMemberSlug(slug: string): Promise<void> {
    const setSlugCallable = httpsCallable<{ slug: string }, { success: boolean; slug: string }>(
      this.functions,
      'setProfileSlug',
    );

    try {
      await setSlugCallable({ slug });

      // Trigger reload of user document
      this.reloadUserDocument();
    } catch (error: unknown) {
      console.error('Failed to set profile slug:', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });

      if (isFirebaseFunctionsError(error)) {
        switch (error.code) {
          case 'unauthenticated': {
            throw new Error('You must be signed in to set a profile slug.');
          }

          case 'failed-precondition': {
            if (error.message.includes('active membership')) {
              throw new Error('Active membership required to set profile slug.');
            }
            if (error.message.includes('already has')) {
              throw new Error('You already have a profile slug. Contact support to change it.');
            }
            break;
          }

          case 'already-exists': {
            throw new Error('This slug is already taken. Please choose another.');
          }

          case 'deadline-exceeded': {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Unable to set profile slug. Please try again.');
    }
  }

  /**
   * Update the user's newsletter subscription preference
   * @param subscribed - true to subscribe, false to unsubscribe
   * @throws Error with user-friendly message
   */
  async updateNewsletterPreference(subscribed: boolean): Promise<void> {
    const updateNewsletterPrefCallable = httpsCallable<
      { subscribed: boolean },
      { success: boolean; subscribed: boolean }
    >(this.functions, 'updateNewsletterPreference');

    try {
      await updateNewsletterPrefCallable({ subscribed });
      // Trigger reload of user document to reflect changes
      this.reloadUserDocument();
    } catch (error: unknown) {
      console.error('Failed to update newsletter preference:', {
        subscribed,
        error: error instanceof Error ? error.message : String(error),
      });

      if (isFirebaseFunctionsError(error)) {
        switch (error.code) {
          case 'unauthenticated': {
            throw new Error('You must be signed in to update newsletter preferences.');
          }

          case 'deadline-exceeded': {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Unable to update newsletter preference. Please try again.');
    }
  }

  /**
   * Trigger a reload of the user document from Firestore
   */
  reloadUserDocument(): void {
    this.userDocumentResource.reload();
  }
}
