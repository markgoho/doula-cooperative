import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { User } from '@angular/fire/auth';
import {
  doc,
  docData,
  DocumentReference,
  Firestore,
  getDoc,
  Timestamp,
} from '@angular/fire/firestore';
import { of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

interface MigratedUserData {
  name: string;
  subscriptionStart: Timestamp;
  hasProfile?: boolean;
}

export interface ClaimableMembershipData {
  name: string;
  subscriptionStart: Date;
  hasProfile: boolean;
}

export interface Member {
  createdAt: Timestamp;
  email: string;
  uid: string;
  name?: string;
  subscriptionStart?: Timestamp;
  membershipActive?: boolean;
  membershipExpiresAt?: Timestamp;
  hasProfile?: boolean;
}

@Injectable({
  providedIn: 'root',
})
export class MembershipService {
  private firestore = inject(Firestore);
  private authService = inject(AuthService);

  userId = computed(() => this.authService.user()?.uid ?? 'abcd');

  userDocument$ = this.authService.userId$.pipe(
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

  async getClaimableProfileData(
    user: User | null | undefined,
  ): Promise<ClaimableMembershipData | undefined> {
    if (user?.email && user.emailVerified) {
      const userDocumentReference = doc(this.firestore, `migrated_users_import/${user.email}`);
      const userDocument = await getDoc(userDocumentReference);

      if (userDocument.exists()) {
        const data = userDocument.data() as MigratedUserData;
        return {
          name: data.name,
          subscriptionStart: data.subscriptionStart.toDate(),
          hasProfile: data.hasProfile ?? false,
        };
      }
    }
    return undefined;
  }
}
