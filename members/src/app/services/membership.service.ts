import { computed, inject, Injectable, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState, type User } from '@angular/fire/auth';
import {
  doc,
  docData,
  DocumentReference,
  Firestore,
  getDoc,
  Timestamp,
} from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { map, of, switchMap } from 'rxjs';

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
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  lastPayment?: Timestamp;
  nextPayment?: Timestamp;
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
  private userId$ = this.user$.pipe(map((user) => user?.uid));

  userId = computed(() => this.auth.currentUser?.uid ?? 'abcd');
  user = toSignal(this.user$);

  // Signal to trigger reload of user document
  private reloadTrigger = signal(0);

  userDocument$ = this.userId$.pipe(
    switchMap((userId) => {
      // Watch the reload trigger to re-fetch when it changes
      this.reloadTrigger();

      if (userId) {
        const userDocumentReference = doc(
          this.firestore,
          `members/${userId}`,
        ) as DocumentReference<Member>;
        return docData(userDocumentReference);
      }
      return of(undefined);
    }),
  );
  userDocument = toSignal(this.userDocument$);

  // Computed properties for easy access to specific member document fields
  membershipActive = computed(() => this.userDocument()?.membershipActive ?? false);
  hasProfile = computed(() => !!this.userDocument()?.slug);

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
   */
  async checkSlugExists(slug: string): Promise<boolean> {
    const checkSlugCallable = httpsCallable<
      { slug: string },
      { available: boolean }
    >(this.functions, 'checkSlugAvailable');

    try {
      const result = await checkSlugCallable({ slug });
      return !result.data.available; // Returns true if slug EXISTS (taken)
    } catch (error) {
      console.error('Error checking slug availability:', error);
      throw error;
    }
  }

  /**
   * Set the profile slug for the current user
   */
  async updateMemberSlug(slug: string): Promise<void> {
    const setSlugCallable = httpsCallable<
      { slug: string },
      { success: boolean; slug: string }
    >(this.functions, 'setProfileSlug');

    try {
      await setSlugCallable({ slug });

      // Trigger reload of user document
      this.reloadUserDocument();
    } catch (error) {
      console.error('Error setting profile slug:', error);
      throw error;
    }
  }

  /**
   * Trigger a reload of the user document from Firestore
   */
  reloadUserDocument(): void {
    this.reloadTrigger.update((v) => v + 1);
  }
}
