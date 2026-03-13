import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { computed, inject, Injectable, resource } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { Auth, authState } from '@angular/fire/auth';
import { firstValueFrom } from 'rxjs';
import { type ApiMemberResponse, type SubscriptionStatus } from '../api-types/members-api.types';

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
  private auth = inject(Auth);
  private http = inject(HttpClient);

  private user$ = authState(this.auth);

  userId = computed(() => this.auth.currentUser?.uid ?? 'abcd');
  user = toSignal(this.user$);

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
          return undefined;
        }
        throw error;
      }
    },
  });

  userDocument = computed((): Member | undefined => {
    if (this.userDocumentResource.hasValue()) {
      return this.userDocumentResource.value();
    }
    return undefined;
  });

  membershipActive = computed(() => this.userDocument()?.membershipActive ?? false);
  hasProfile = computed(() => !!this.userDocument()?.profileCreatedAt);

  async checkSlugExists(slug: string): Promise<boolean> {
    try {
      const result = await firstValueFrom(
        this.http.get<{ available: boolean }>('/api/profiles/slugs/check', {
          params: { slug },
        }),
      );
      return !result.available;
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

  async updateMemberSlug(slug: string): Promise<void> {
    try {
      await firstValueFrom(
        this.http.post<{ success: boolean; slug: string }>('/api/profiles/slugs', { slug }),
      );
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

  async updateNewsletterPreference(subscribed: boolean): Promise<void> {
    const uid = this.auth.currentUser?.uid;
    if (!uid) {
      throw new Error('You must be signed in to update newsletter preferences.');
    }

    try {
      await firstValueFrom(
        this.http.patch<{ success: boolean; subscribed: boolean }>(
          `/api/members/${uid}/newsletter-preference`,
          { subscribed },
        ),
      );
      this.reloadUserDocument();
    } catch (error: unknown) {
      console.error('Failed to update newsletter preference:', {
        subscribed,
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to update newsletter preferences.');
          }
          case 403: {
            throw new Error('You do not have permission to update newsletter preferences.');
          }
          case 404: {
            throw new Error('Member account not found. Please contact support.');
          }
          case 400:
          case 422: {
            throw new Error('Invalid request. Please try again.');
          }
          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Unable to update newsletter preference. Please try again.');
    }
  }

  async updateMemberName(name: string): Promise<void> {
    const uid = this.auth.currentUser?.uid;
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
      this.reloadUserDocument();
    } catch (error: unknown) {
      console.error('Failed to update member name:', {
        error: error instanceof Error ? error.message : String(error),
      });

      if (error instanceof HttpErrorResponse) {
        switch (error.status) {
          case 401: {
            throw new Error('You must be signed in to update your name.');
          }
          case 403: {
            throw new Error('You do not have permission to update this name.');
          }
          case 404: {
            throw new Error('Member account not found. Please contact support.');
          }
          case 422: {
            throw new Error('Invalid name. Please check your input and try again.');
          }
          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
          default: {
            throw new Error(
              `Unable to update your name (error ${String(error.status)}). Please try again or contact support.`,
            );
          }
        }
      }

      throw new Error('Unable to update your name. Please try again.');
    }
  }

  async cancelMembership(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
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
            );
          }
          case 401: {
            throw new Error('You must be signed in to cancel your membership.');
          }
          case 403: {
            throw new Error('You do not have permission to cancel this membership.');
          }
          case 404: {
            throw new Error('Member account not found. Please contact support.');
          }
          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Unable to cancel membership. Please try again or contact support.');
    }
  }

  reloadUserDocument(): void {
    this.userDocumentResource.reload();
  }

  async verifyEmail(): Promise<void> {
    const uid = this.auth.currentUser?.uid;
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
            throw new Error('Email is already verified.');
          }
          case 401: {
            throw new Error('You must be signed in to verify your email.');
          }
          case 403: {
            throw new Error('You do not have permission to verify this email.');
          }
          case 504: {
            throw new Error('Request timed out. Please check your connection and try again.');
          }
        }
      }

      throw new Error('Unable to verify email. Please try again.');
    }
  }

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
