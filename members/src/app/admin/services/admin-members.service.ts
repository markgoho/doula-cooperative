import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';
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

@Injectable({
  providedIn: 'root',
})
export class AdminMembersService {
  private httpClient = inject(HttpClient);
  private functions = inject(Functions);

  async listMembers(): Promise<ListMembersResponse> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(this.httpClient.get<ListMembersResponse>('/api/admin/members/'));
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

  async deactivateMembership(uid: string): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.post<{ success: boolean }>(
        `/api/admin/members/${uid}/membership/deactivate`,
        {},
      ),
    );
  }

  async extendMembership(uid: string, newExpirationDate: string): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.post<{ success: boolean }>(
        `/api/admin/members/${uid}/membership/extend`,
        { newExpirationDate },
      ),
    );
  }

  async readMemberProfile(uid: string): Promise<{ content: string; image?: string; slug: string }> {
    const readProfileCallable = httpsCallable<
      { uid: string },
      { content: string; image?: string; slug: string }
    >(this.functions, 'adminReadMemberProfile');

    const result = await readProfileCallable({ uid });
    return result.data;
  }

  async listUnclaimedProfiles(limit = 50, offset = 0): Promise<ListUnclaimedProfilesResponse> {
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

  private convertUnclaimedProfileTimestamps(profile: ApiUnclaimedProfileResponse): UnclaimedProfile {
    try {
      const result: UnclaimedProfile = {
        email: profile.email,
        name: profile.name,
        subscriptionStart: this.toTimestamp(profile.subscriptionStart),
        ...(profile.slug !== undefined && { slug: profile.slug }),
        ...(profile.invitationEmailStatus !== undefined && {
          invitationEmailStatus: profile.invitationEmailStatus,
        }),
        ...(profile.invitationEmailError !== undefined && {
          invitationEmailError: profile.invitationEmailError,
        }),
        ...(profile.lastPayment !== undefined && {
          lastPayment: this.toTimestamp(profile.lastPayment),
        }),
        ...(profile.nextPayment !== undefined && {
          nextPayment: this.toTimestamp(profile.nextPayment),
        }),
        ...(profile.invitationEmailSentAt !== undefined && {
          invitationEmailSentAt: this.toTimestamp(profile.invitationEmailSentAt),
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

  async deleteUser(uid: string): Promise<{ success: boolean }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.delete<{ success: boolean }>(`/api/admin/members/${uid}`),
    );
  }

  async sendInvitation(email: string): Promise<{ success: boolean }> {
    const sendInvitationCallable = httpsCallable<{ email: string }, { success: boolean }>(
      this.functions,
      'adminSendInvitation',
    );

    const result = await sendInvitationCallable({ email });
    return result.data;
  }
}
