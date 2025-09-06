import { inject, Injectable } from '@angular/core';
import { User } from '@angular/fire/auth';
import { doc, Firestore, getDoc } from '@angular/fire/firestore';

@Injectable({
  providedIn: 'root',
})
export class MembershipService {
  private firestore = inject(Firestore);

  async checkForClaimableProfile(user: User | null | undefined): Promise<boolean> {
    if (user?.email && user.emailVerified) {
      const userDocumentReference = doc(this.firestore, `migrated_users_import/${user.email}`);
      const userDocument = await getDoc(userDocumentReference);
      return userDocument.exists();
    }
    return false;
  }
}
