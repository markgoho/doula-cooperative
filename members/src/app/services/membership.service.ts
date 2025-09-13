import { computed, inject, Injectable } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { doc, docData, DocumentReference, Firestore, Timestamp } from '@angular/fire/firestore';
import { of, switchMap } from 'rxjs';
import { AuthService } from './auth.service';

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

  private userDocument$ = this.authService.user$.pipe(
    switchMap((user) => {
      if (!user) {
        // eslint-disable-next-line unicorn/no-useless-undefined
        return of(undefined);
      }
      const userDocumentReference = doc(
        this.firestore,
        `members/${user.uid}`,
      ) as DocumentReference<UserDocument>;
      return docData(userDocumentReference);
    }),
  );

  userDocument = toSignal(this.userDocument$);
  isInitialLoad = computed(() => this.userDocument() === undefined);
}
