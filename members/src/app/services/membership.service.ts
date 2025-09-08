import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { User } from '@angular/fire/auth';
import { doc, Firestore, getDoc, Timestamp } from '@angular/fire/firestore';
import { AuthService } from './auth.service';

interface MigratedUserData {
  name: string;
  subscriptionStart: Timestamp;
}

interface UserDocument {
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

  userId = computed(() => this.authService.user()?.uid ?? '');

  // eslint-disable-next-line unicorn/no-useless-undefined
  userDocument = signal<UserDocument | undefined>(undefined);

  constructor() {
    // Load user document when userId changes
    effect(() => {
      console.log('UserId changed:', this.userId());
      const userId = this.userId();
      if (userId) {
        void this.loadUserDocument(userId);
      } else {
        this.userDocument.set(undefined);
      }
    });
  }

  private async loadUserDocument(userId: string): Promise<void> {
    try {
      const documentReference = doc(this.firestore, `members/${userId}`);
      const documentData = await getDoc(documentReference);
      if (documentData.exists()) {
        this.userDocument.set(documentData.data() as UserDocument);
      } else {
        this.userDocument.set(undefined);
      }
    } catch (error) {
      console.error('Error loading user document:', error);
      this.userDocument.set(undefined);
    }
  }

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
