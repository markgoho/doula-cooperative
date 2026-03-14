import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { firstValueFrom } from 'rxjs';
import type {
  ListMembersResponse,
  ListUnclaimedProfilesResponse,
  Member,
  UnclaimedProfile,
} from '../admin.types';
import type {
  ApiListUnclaimedProfilesResponse,
  ApiUnclaimedProfileResponse,
} from '../api-types/admin-unclaimed-profiles-api.types';

interface Contact {
  email?: string;
  phone?: string;
  website?: string;
  business_name?: string;
}

@Injectable({
  providedIn: 'root',
})
export class AdminMembersService {
  private httpClient = inject(HttpClient);

  async listMembers(): Promise<ListMembersResponse> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(this.httpClient.get<ListMembersResponse>('/api/admin/members'));
  }

  async getMember(uid: string): Promise<Member> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(this.httpClient.get<Member>(`/api/admin/members/${uid}`));
  }

  private toTimestamp(
    value:
      | Timestamp
      | string
      | { seconds: number; nanoseconds: number }
      | { _seconds: number; _nanoseconds: number },
  ): Timestamp {
    if (value === null || value === undefined) {
      throw new Error(
        `Timestamp value is ${value === null ? 'null' : 'undefined'}. Expected a valid Timestamp object or ISO string.`,
      );
    }

    if (value instanceof Timestamp) {
      return value;
    }

    // Handle ISO 8601 string format from Elysia API
    if (typeof value === 'string') {
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) {
        throw new TypeError(`Invalid date string: ${value}`);
      }
      return Timestamp.fromDate(date);
    }

    // Handle both formats that Firebase might return
    const seconds = 'seconds' in value ? value.seconds : (value as { _seconds: number })._seconds;
    const nanoseconds =
      'nanoseconds' in value ? value.nanoseconds : (value as { _nanoseconds: number })._nanoseconds;

    return new Timestamp(seconds, nanoseconds);
  }

  async updateMember(uid: string, updates: Partial<Member>): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.patch<{ success: boolean }>(`/api/admin/members/${uid}`, updates),
    );
  }

  async activateMembership(
    uid: string,
    subscriptionStart?: string,
    membershipExpiresAt?: string,
  ): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    const body = {
      ...(subscriptionStart !== undefined && { subscriptionStart }),
      ...(membershipExpiresAt !== undefined && { membershipExpiresAt }),
    };
    return firstValueFrom(
      this.httpClient.post<{ success: boolean }>(
        `/api/admin/members/${uid}/membership/activate`,
        body,
      ),
    );
  }

  async cancelMembership(uid: string): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.post<{ success: boolean }>(`/api/admin/members/${uid}/membership/cancel`, {}),
    );
  }

  async extendMembership(uid: string, newExpirationDate: string): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.post<{ success: boolean }>(`/api/admin/members/${uid}/membership/extend`, {
        newExpirationDate,
      }),
    );
  }

  async readMemberProfile(uid: string): Promise<{
    title: string;
    bio: string;
    credentials?: string;
    pronouns?: string;
    tags?: string[];
    contact?: Contact;
    draft?: boolean;
    image?: string;
    slug: string;
  }> {
    // Use dedicated admin endpoint that reads directly from Firestore,
    // bypassing the public endpoint's draft access control
    const result = await firstValueFrom(
      this.httpClient.get<{
        success: boolean;
        slug: string;
        profile: {
          title: string;
          bio: string;
          credentials?: string;
          pronouns?: string;
          tags?: string[];
          contact?: Contact;
          draft?: boolean;
          image?: string;
        };
      }>(`/api/admin/members/${uid}/profile`),
    );

    return {
      title: result.profile.title,
      bio: result.profile.bio,
      ...(result.profile.credentials !== undefined && { credentials: result.profile.credentials }),
      ...(result.profile.pronouns !== undefined && { pronouns: result.profile.pronouns }),
      ...(result.profile.tags !== undefined && { tags: result.profile.tags }),
      ...(result.profile.contact !== undefined && { contact: result.profile.contact }),
      ...(result.profile.draft !== undefined && { draft: result.profile.draft }),
      ...(result.profile.image !== undefined && { image: result.profile.image }),
      slug: result.slug,
    };
  }

  async listUnclaimedProfiles(limit = 100, offset = 0): Promise<ListUnclaimedProfilesResponse> {
    // Authorization header added automatically by authInterceptor
    const parameters = new HttpParams()
      .set('limit', limit.toString())
      .set('offset', offset.toString());

    const result = await firstValueFrom(
      this.httpClient.get<ApiListUnclaimedProfilesResponse>('/api/admin/unclaimed-profiles', {
        params: parameters,
      }),
    );

    // Convert ISO string timestamps to Timestamp instances
    const profiles = result.profiles.map((profile) =>
      this.convertUnclaimedProfileTimestamps(profile),
    );

    return {
      profiles,
      total: result.total,
    };
  }

  async getUnclaimedProfile(email: string): Promise<UnclaimedProfile> {
    // Authorization header added automatically by authInterceptor
    const result = await firstValueFrom(
      this.httpClient.get<ApiUnclaimedProfileResponse>(`/api/admin/unclaimed-profiles/${email}`),
    );
    return this.convertUnclaimedProfileTimestamps(result);
  }

  private convertUnclaimedProfileTimestamps(
    profile: ApiUnclaimedProfileResponse,
  ): UnclaimedProfile {
    try {
      const result: UnclaimedProfile = {
        email: profile.email,
        name: profile.name,
        subscriptionStart: this.toTimestamp(profile.subscriptionStart),
        ...(profile.slug !== undefined && { slug: profile.slug }),
        ...(profile.lastPayment !== undefined && {
          lastPayment: this.toTimestamp(profile.lastPayment),
        }),
        ...(profile.nextPayment !== undefined && {
          nextPayment: this.toTimestamp(profile.nextPayment),
        }),
      };

      return result;
    } catch (error) {
      console.error(
        `Error converting timestamps for unclaimed profile: ${profile.name} (${profile.email})`,
        {
          profile,
          error,
        },
      );
      throw error;
    }
  }

  async deleteUnclaimedProfile(email: string): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.delete<{ success: boolean }>(`/api/admin/unclaimed-profiles/${email}`),
    );
  }

  async updateEmail(email: string, newEmail: string): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.patch<{ success: boolean }>(`/api/admin/unclaimed-profiles/${email}`, {
        newEmail,
      }),
    );
  }

  async refreshPaymentDates(): Promise<{
    success: boolean;
    updatedCount: number;
    totalCount: number;
  }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.post<{ success: boolean; updatedCount: number; totalCount: number }>(
        '/api/admin/unclaimed-profiles/refresh-payment-dates',
        {},
      ),
    );
  }

  async refundMembership(
    uid: string,
    reason?: string,
  ): Promise<{
    success: boolean;
    refundResult: {
      stripeRefundCreated: boolean;
      subscriptionCanceled: boolean;
      memberDeactivated: boolean;
      profileDrafted?: boolean;
      newsletterUnsubscribed?: boolean;
      warning?: string;
    };
  }> {
    // Authorization header added automatically by authInterceptor
    const body = {
      ...(reason !== undefined && { reason }),
    };
    return firstValueFrom(
      this.httpClient.post<{
        success: boolean;
        refundResult: {
          stripeRefundCreated: boolean;
          subscriptionCanceled: boolean;
          memberDeactivated: boolean;
          profileDrafted?: boolean;
          newsletterUnsubscribed?: boolean;
          warning?: string;
        };
      }>(`/api/admin/members/${uid}/membership/refund`, body),
    );
  }

  async cleanSlateDelete(uid: string): Promise<{
    success: boolean;
    deletedUid: string;
    subscriptionCanceled?: boolean;
    stripeCustomerDeleted?: boolean;
    newsletterUnsubscribed?: boolean;
    profileDeleted?: boolean;
    profileImageDeleted?: boolean;
    memberDocumentDeleted: boolean;
    authUserDeleted: boolean;
    warning?: string;
  }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.post<{
        success: boolean;
        deletedUid: string;
        subscriptionCanceled?: boolean;
        stripeCustomerDeleted?: boolean;
        newsletterUnsubscribed?: boolean;
        profileDeleted?: boolean;
        profileImageDeleted?: boolean;
        memberDocumentDeleted: boolean;
        authUserDeleted: boolean;
        warning?: string;
      }>(`/api/admin/members/${uid}/clean-slate`, {}),
    );
  }

  async toggleProfileDraft(uid: string): Promise<{
    success: boolean;
    slug: string;
    draft: boolean;
    warning?: string;
  }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.post<{
        success: boolean;
        slug: string;
        draft: boolean;
        warning?: string;
      }>(`/api/admin/members/${uid}/profile/toggle-draft`, {}),
    );
  }
}
