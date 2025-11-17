import { computed, inject, Injectable } from '@angular/core';
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
}

@Injectable({
  providedIn: 'root',
})
export class MembershipService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);

  // Use authState directly to avoid circular dependency with AuthService
  private user$ = authState(this.auth);
  private userId$ = this.user$.pipe(map((user) => user?.uid));

  userId = computed(() => this.auth.currentUser?.uid ?? 'abcd');

  userDocument$ = this.userId$.pipe(
    switchMap((userId) => {
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
}
