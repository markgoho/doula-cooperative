import { inject, Injectable } from '@angular/core';
import { User } from '@angular/fire/auth';
import { doc, Firestore, getDoc, Timestamp } from '@angular/fire/firestore';

interface MigratedUserData {
  name: string;
  subscriptionStart: Timestamp;
}

@Injectable({
  providedIn: 'root',
})
export class MembershipService {
  private firestore = inject(Firestore);

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
