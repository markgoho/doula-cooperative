import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState, type User } from '@angular/fire/auth';
import { doc, Firestore, getDoc, Timestamp } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { firstValueFrom } from 'rxjs';
import { isFirebaseFunctionsError } from '../types/firebase-error';
import {
  type ApiMemberResponse,
  type SubscriptionStatus,
} from '../api-types/members-api.types';

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

export interface Member {
  createdAt: Date;
  email: string;
  uid: string;
  isAdmin: boolean;
  name?: string;
  subscriptionStart?: Date;
  membershipActive?: boolean;
  membershipExpiresAt?: Date;
  slug?: string;
  profileCreatedAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  lastPayment?: Date;
  nextPayment?: Date;
  newsletterSubscribed?: boolean;
  newsletterSubscribedAt?: Date;
  newsletterUnsubscribedAt?: Date;
}

@Injectable({
  providedIn: 'root',
})
export class MembershipService {
  private firestore = inject(Firestore);
  private auth = inject(Auth);
  private functions = inject(Functions);
  private http = inject(HttpClient);

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
      try {
        const response = await firstValueFrom(
          this.http.get<ApiMemberResponse>(`/api/members/${params.uid}`),
        );
        return this.convertApiResponseToMember(response);
      } catch (error: unknown) {
        if (error instanceof HttpErrorResponse && error.status === 404) {
          return undefined; // Member document doesn't exist yet
        }
        throw error; // Propagate other errors
      }
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
    try {
      const result = await firstValueFrom(
        this.http.get<{ available: boolean }>('/api/profiles/slugs/check', {
          params: { slug },
        }),
      );
      return !result.available; // Returns true if slug EXISTS (taken)
    } catch (error: unknown) {
      console.error('Slug availability check failed:', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to check slug availability.');
          }

          case 504: {
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
    try {
      await firstValueFrom(
        this.http.post<{ success: boolean; slug: string }>('/api/profiles/slugs', { slug }),
      );

      // Trigger reload of user document
      this.reloadUserDocument();
    } catch (error: unknown) {
      console.error('Failed to set profile slug:', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to set a profile slug.');
          }

          case 403: {
            if (error.error?.error?.includes('membership')) {
              throw new Error('Active membership required to set profile slug.');
            }
            throw new Error('You do not have permission to set a profile slug.');
          }

          case 404: {
            if (error.error?.error?.includes('member')) {
              throw new Error('Member account not found. Please contact support.');
            }
            throw new Error('Unable to set profile slug. Please try again.');
          }

          case 409: {
            if (error.error?.error?.includes('already has')) {
              throw new Error('You already have a profile slug. Contact support to change it.');
            }
            if (error.error?.error?.includes('already taken')) {
              throw new Error('This slug is already taken. Please choose another.');
            }
            throw new Error('Slug conflict. Please try again.');
          }

          case 504: {
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
   * Trigger a reload of the user document from the API
   */
  reloadUserDocument(): void {
    this.userDocumentResource.reload();
  }

  /**
   * Claim an unclaimed profile for the authenticated user
   * @param slug - The slug of the profile to claim
   * @throws Error with user-friendly message
   */
  async claimProfile(slug: string): Promise<void> {
    const user = this.auth.currentUser;
    if (!user) {
      console.error('Attempted to claim profile without a logged-in user.');
      throw new Error('No authenticated user to claim profile.');
    }

    // Force a refresh of the user's ID token to get the latest claims
    // and email_verified status before calling the API.
    await user.getIdToken(true);

    try {
      await firstValueFrom(
        this.http.post<{ status: string; data?: unknown }>(`/api/profiles/${slug}/claim`, {}),
      );
    } catch (error) {
      console.error('Error calling claimProfile API:', {
        slug,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to claim a profile.');
          }

          case 428: {
            if (error.error?.error?.includes('verified email')) {
              throw new Error('Please verify your email address before claiming your profile.');
            }
            throw new Error('Email verification required to claim profile.');
          }

          case 404: {
            throw new Error('No profile found to claim.');
          }

          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.');
          }

          default: {
            throw new Error('Unable to claim profile. Please try again or contact support.');
          }
        }
      }

      // Handle non-HTTP errors (network failures, Angular errors, etc.)
      throw new Error('Unable to claim profile. Please check your connection and try again.');
    }
  }

  /**
   * Convert API response (ISO string dates) to Member interface (Date objects)
   */
  private convertApiResponseToMember(apiResponse: ApiMemberResponse): Member {
    return {
      uid: apiResponse.uid,
      email: apiResponse.email,
      createdAt: new Date(apiResponse.createdAt),
      isAdmin: apiResponse.isAdmin,
      ...(apiResponse.name !== undefined && { name: apiResponse.name }),
      ...(apiResponse.subscriptionStart !== undefined && {
        subscriptionStart: new Date(apiResponse.subscriptionStart),
      }),
      ...(apiResponse.membershipActive !== undefined && {
        membershipActive: apiResponse.membershipActive,
      }),
      ...(apiResponse.membershipExpiresAt !== undefined && {
        membershipExpiresAt: new Date(apiResponse.membershipExpiresAt),
      }),
      ...(apiResponse.slug !== undefined && { slug: apiResponse.slug }),
      ...(apiResponse.profileCreatedAt !== undefined && {
        profileCreatedAt: new Date(apiResponse.profileCreatedAt),
      }),
      ...(apiResponse.stripeCustomerId !== undefined && {
        stripeCustomerId: apiResponse.stripeCustomerId,
      }),
      ...(apiResponse.stripeSubscriptionId !== undefined && {
        stripeSubscriptionId: apiResponse.stripeSubscriptionId,
      }),
      ...(apiResponse.subscriptionStatus !== undefined && {
        subscriptionStatus: apiResponse.subscriptionStatus,
      }),
      ...(apiResponse.lastPayment !== undefined && {
        lastPayment: new Date(apiResponse.lastPayment),
      }),
      ...(apiResponse.nextPayment !== undefined && {
        nextPayment: new Date(apiResponse.nextPayment),
      }),
      ...(apiResponse.newsletterSubscribed !== undefined && {
        newsletterSubscribed: apiResponse.newsletterSubscribed,
      }),
      ...(apiResponse.newsletterSubscribedAt !== undefined && {
        newsletterSubscribedAt: new Date(apiResponse.newsletterSubscribedAt),
      }),
      ...(apiResponse.newsletterUnsubscribedAt !== undefined && {
        newsletterUnsubscribedAt: new Date(apiResponse.newsletterUnsubscribedAt),
      }),
    };
  }
}
