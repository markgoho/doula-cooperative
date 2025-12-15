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
      | { seconds: number; nanoseconds: number }
      | { _seconds: number; _nanoseconds: number },
  ): Timestamp {
    if (value === null || value === undefined) {
      throw new Error(
        `Timestamp value is ${value === null ? 'null' : 'undefined'}. Expected a valid Timestamp object.`,
      );
    }

    if (value instanceof Timestamp) {
      return value;
    }

    // Validate that value is an object
    if (typeof value !== 'object') {
      throw new TypeError(
        `Expected Timestamp object but received ${typeof value}: ${JSON.stringify(value)}`,
      );
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
      this.httpClient.get<ListUnclaimedProfilesResponse>('/api/admin/unclaimed-profiles', {
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
      this.httpClient.get<UnclaimedProfile>(`/api/admin/unclaimed-profiles/${email}`),
    );
    return this.convertUnclaimedProfileTimestamps(result);
  }

  private convertUnclaimedProfileTimestamps(profile: UnclaimedProfile): UnclaimedProfile {
    try {
      const result: UnclaimedProfile = {
        ...profile,
        subscriptionStart: this.toTimestamp(profile.subscriptionStart),
      };

      if (profile.lastPayment) {
        result.lastPayment = this.toTimestamp(profile.lastPayment);
      }

      if (profile.nextPayment) {
        result.nextPayment = this.toTimestamp(profile.nextPayment);
      }

      if (profile.invitationEmailSentAt) {
        result.invitationEmailSentAt = this.toTimestamp(profile.invitationEmailSentAt);
      }
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
