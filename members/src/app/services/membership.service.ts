import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, effect, inject, resource, Service, signal } from '@angular/core';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { firstValueFrom } from 'rxjs';
import { auth } from '../lib/firebase';
import type { ApiMemberResponse } from '../api-types/api-member-response';
import type { SubscriptionStatus } from '../api-types/subscription-status';

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
  profileApprovedAt?: Date;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  lastPayment?: Date;
  nextPayment?: Date;
  newsletterSubscribed?: boolean;
  newsletterSubscribedAt?: Date;
  newsletterUnsubscribedAt?: Date;
}

@Service()
export class MembershipService {
  private http = inject(HttpClient);

  // eslint-disable-next-line unicorn/no-null
  private readonly authUser = signal<User | null>(null);
  readonly user = this.authUser.asReadonly();
  readonly userId = computed(() => this.authUser()?.uid ?? 'abcd');

  constructor() {
    effect((onCleanup) => {
      const unsubscribe = onAuthStateChanged(
        auth,
        (user) => this.authUser.set(user),
        (error) => console.error('Auth state listener error:', error),
      );
      onCleanup(unsubscribe);
    });
  }

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
            throw new Error('You must be signed in to check slug availability.', { cause: error });
          }

          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.', { cause: error });
          }
        }
      }

      throw new Error('Unable to check slug availability. Please try again.', { cause: error });
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
            throw new Error('You must be signed in to set a profile slug.', { cause: error });
          }

          case 403: {
            if (error.error?.error?.includes('membership')) {
              throw new Error('Active membership required to set profile slug.', { cause: error });
            }
            throw new Error('You do not have permission to set a profile slug.', { cause: error });
          }

          case 404: {
            if (error.error?.error?.includes('member')) {
              throw new Error('Member account not found. Please contact support.', { cause: error });
            }
            throw new Error('Unable to set profile slug. Please try again.', { cause: error });
          }

          case 409: {
            if (error.error?.error?.includes('already has')) {
              throw new Error('You already have a profile slug. Contact support to change it.', { cause: error });
            }
            if (error.error?.error?.includes('already taken')) {
              throw new Error('This slug is already taken. Please choose another.', { cause: error });
            }
            throw new Error('Slug conflict. Please try again.', { cause: error });
          }

          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.', { cause: error });
          }
        }
      }

      throw new Error('Unable to set profile slug. Please try again.', { cause: error });
    }
  }

  /**
   * Update the user's newsletter subscription preference
   * @param subscribed - true to subscribe, false to unsubscribe
   * @throws Error with user-friendly message
   */
  async updateNewsletterPreference(isSubscribed: boolean): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('You must be signed in to update newsletter preferences.');
    }

    try {
      await firstValueFrom(
        this.http.patch<{ success: boolean; subscribed: boolean }>(
          `/api/members/${uid}/newsletter-preference`,
          { subscribed: isSubscribed },
        ),
      );
      // Trigger reload of user document to reflect changes
      this.reloadUserDocument();
    } catch (error: unknown) {
      console.error('Failed to update newsletter preference:', {
        subscribed: isSubscribed,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to update newsletter preferences.', { cause: error });
          }

          case 403: {
            throw new Error('You do not have permission to update newsletter preferences.', { cause: error });
          }

          case 404: {
            throw new Error('Member account not found. Please contact support.', { cause: error });
          }

          case 400:
          case 422: {
            throw new Error('Invalid request. Please try again.', { cause: error });
          }

          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.', { cause: error });
          }
        }
      }

      throw new Error('Unable to update newsletter preference. Please try again.', { cause: error });
    }
  }

  /**
   * Update the member's name.
   * Triggers `reloadUserDocument()` on success to refresh the cached member data.
   * @param name - The full name to set
   * @throws Error with user-friendly message
   */
  async updateMemberName(name: string): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('You must be signed in to update your name.');
    }

    try {
      await firstValueFrom(
        this.http.patch<{ success: boolean; member: ApiMemberResponse }>(
          `/api/members/${uid}/name`,
          { name },
        ),
      );
      // Trigger reload of user document to reflect changes
      this.reloadUserDocument();
    } catch (error: unknown) {
      console.error('Failed to update member name:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to update your name.', { cause: error });
          }

          case 403: {
            throw new Error('You do not have permission to update this name.', { cause: error });
          }

          case 404: {
            throw new Error('Member account not found. Please contact support.', { cause: error });
          }

          case 422: {
            throw new Error('Invalid name. Please check your input and try again.', { cause: error });
          }

          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.', { cause: error });
          }

          default: {
            throw new Error(
              `Unable to update your name (error ${String(error.status)}). Please try again or contact support.`,
              { cause: error },
            );
          }
        }
      }

      throw new Error('Unable to update your name. Please try again.', { cause: error });
    }
  }

  /**
   * Cancel the current user's membership.
   * Schedules Stripe subscription cancellation at end of billing period.
   * @throws Error with user-friendly message
   */
  async cancelMembership(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('You must be signed in to cancel your membership.');
    }

    try {
      await firstValueFrom(
        this.http.post<{ success: boolean; member: ApiMemberResponse }>(
          `/api/members/${uid}/membership/cancel`,
          {},
        ),
      );
      // Trigger reload of user document to reflect changes
      this.reloadUserDocument();
    } catch (error: unknown) {
      console.error('Failed to cancel membership:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 400: {
            throw new Error(
              'Unable to cancel membership online. Please contact support for assistance.',
              { cause: error },
            );
          }
          case 401: {
            throw new Error('You must be signed in to cancel your membership.', { cause: error });
          }
          case 403: {
            throw new Error('You do not have permission to cancel this membership.', { cause: error });
          }
          case 404: {
            throw new Error('Member account not found. Please contact support.', { cause: error });
          }
          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.', { cause: error });
          }
        }
      }

      throw new Error('Unable to cancel membership. Please try again or contact support.', { cause: error });
    }
  }

  /**
   * Trigger a reload of the user document from the API
   */
  reloadUserDocument(): void {
    this.userDocumentResource.reload();
  }

  /**
   * Mark the current user's email as verified via the API.
   * Currently used after password reset + sign-in, where confirming
   * the reset code proves email ownership.
   * @throws Error with user-friendly message
   */
  async verifyEmail(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('You must be signed in to verify your email.');
    }

    try {
      await firstValueFrom(
        this.http.post<{ success: boolean }>(`/api/members/${uid}/verify-email`, {}),
      );
    } catch (error: unknown) {
      console.error('Failed to verify email:', {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 400: {
            throw new Error('Email is already verified.', { cause: error });
          }
          case 401: {
            throw new Error('You must be signed in to verify your email.', { cause: error });
          }
          case 403: {
            throw new Error('You do not have permission to verify this email.', { cause: error });
          }
          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.', { cause: error });
          }
        }
      }

      throw new Error('Unable to verify email. Please try again.', { cause: error });
    }
  }

  async syncAuthEmailToMember(): Promise<void> {
    const uid = auth.currentUser?.uid;
    if (!uid) {
      throw new Error('You must be signed in to update your email.');
    }

    try {
      await firstValueFrom(
        this.http.post<{ success: boolean }>(`/api/members/${uid}/sync-email`, {}),
      );
      this.reloadUserDocument();
    } catch (error: unknown) {
      console.error('Failed to sync auth email to member document:', {
        uid,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to update your email.', { cause: error });
          }
          case 403: {
            throw new Error('You do not have permission to update your email.', { cause: error });
          }
          case 404: {
            throw new Error('Member account not found. Please contact support.', { cause: error });
          }
          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.', { cause: error });
          }
          case 500: {
            const serverMessage =
              typeof error.error === 'object' &&
              error.error !== null &&
              typeof (error.error as { error?: unknown }).error === 'string'
                ? (error.error as { error: string }).error
                : undefined;
            if (serverMessage) {
              throw new Error(serverMessage, { cause: error });
            }
          }
        }
      }

      throw new Error(
        'We updated your sign-in email, but could not refresh your membership email. Please try again.',
        { cause: error },
      );
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
      ...(apiResponse.profileApprovedAt !== undefined && {
        profileApprovedAt: new Date(apiResponse.profileApprovedAt),
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
