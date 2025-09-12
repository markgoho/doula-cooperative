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
}
