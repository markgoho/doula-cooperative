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
}

export interface UserDocument {
  createdAt: Timestamp;
  email: string;
  uid: string;
  emailVerified: boolean;
  name?: string;
  subscriptionStart?: Timestamp;
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
        ) as DocumentReference<UserDocument>;
        return docData(userDocumentReference);
      }
      // eslint-disable-next-line unicorn/no-useless-undefined
      return of(undefined);
    }),
  );
  userDocument = toSignal(this.userDocument$);

  async getClaimableProfileData(
    user: User | null | undefined,
  ): Promise<{ name: string; subscriptionStart: Date } | undefined> {
    if (user?.email && user.emailVerified) {
      const userDocumentReference = doc(this.firestore, `migrated_users_import/${user.email}`);
      const userDocument = await getDoc(userDocumentReference);

      if (userDocument.exists()) {
        const data = userDocument.data() as MigratedUserData;
        return {
          name: data.name,
          subscriptionStart: data.subscriptionStart.toDate(),
        };
      }
    }
    return undefined;
  }
}
