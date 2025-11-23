import { inject, Injectable } from '@angular/core';
import { Timestamp } from '@angular/fire/firestore';
import { Functions, httpsCallable } from '@angular/fire/functions';

export type SubscriptionStatus =
  | 'active'
  | 'past_due'
  | 'canceled'
  | 'incomplete'
  | 'trialing'
  | 'unpaid';

export interface Member {
  createdAt: Timestamp;
  email: string;
  uid: string;
  name?: string;
  subscriptionStart?: Timestamp;
  membershipActive?: boolean;
  membershipExpiresAt?: Timestamp;
  slug?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
  isAdmin?: boolean;
}

export interface UnclaimedProfile {
  email: string;
  name: string;
  subscriptionStart: Timestamp;
  lastPayment?: Timestamp;
  nextPayment?: Timestamp;
  slug?: string;
  invitationEmailStatus?: 'sent' | 'failed' | 'pending';
  invitationEmailSentAt?: Timestamp;
  invitationEmailError?: string;
}

export interface ListMembersResponse {
  members: Member[];
  total: number;
}

export interface ListUnclaimedProfilesResponse {
  profiles: UnclaimedProfile[];
  total: number;
}

export interface MatchRequest {
  id: string;
  name: string;
  phone: string;
  email: string;
  zipcode: string;
  estimatedDueDate: {
    month: string;
    day: string;
    year: string;
  };
  services: string[];
  birthLocation: string;
  otherInfo: string;
  insurance: string[];
  submitted: string;
  sent: boolean;
}

export interface ListMatchRequestsResponse {
  requests: MatchRequest[];
  total: number;
  pendingCount: number;
  processedCount: number;
}

@Injectable({
  providedIn: 'root',
})
export class AdminMembersService {
  private functions = inject(Functions);

  async listMembers(limit = 50, offset = 0): Promise<ListMembersResponse> {
    const listMembersCallable = httpsCallable<
      { limit?: number; offset?: number },
      ListMembersResponse
    >(this.functions, 'adminListMembers');

    const result = await listMembersCallable({ limit, offset });

    // Convert timestamp objects to Timestamp instances
    const members = result.data.members.map((member) => this.convertMemberTimestamps(member));

    return {
      members,
      total: result.data.total,
    };
  }

  async getMember(uid: string): Promise<Member> {
    const getMemberCallable = httpsCallable<{ uid: string }, Member>(
      this.functions,
      'adminGetMember',
    );

    const result = await getMemberCallable({ uid });
    return this.convertMemberTimestamps(result.data);
  }

  private convertMemberTimestamps(member: Member): Member {
    const result: Member = {
      ...member,
      createdAt: this.toTimestamp(member.createdAt),
    };
    if (member.subscriptionStart) {
      result.subscriptionStart = this.toTimestamp(member.subscriptionStart);
    }
    if (member.membershipExpiresAt) {
      result.membershipExpiresAt = this.toTimestamp(member.membershipExpiresAt);
    }
    return result;
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
    const updateMemberCallable = httpsCallable<
      { uid: string; updates: Partial<Member> },
      { success: boolean }
    >(this.functions, 'adminUpdateMember');

    const result = await updateMemberCallable({ uid, updates });
    return result.data;
  }

  async activateMembership(
    uid: string,
    subscriptionStart?: string,
    membershipExpiresAt?: string,
  ): Promise<{ success: boolean }> {
    const activateCallable = httpsCallable<
      { uid: string; subscriptionStart?: string; membershipExpiresAt?: string },
      { success: boolean }
    >(this.functions, 'adminActivateMembership');

    const parameters: { uid: string; subscriptionStart?: string; membershipExpiresAt?: string } = {
      uid,
    };
    if (subscriptionStart !== undefined) {
      parameters.subscriptionStart = subscriptionStart;
    }
    if (membershipExpiresAt !== undefined) {
      parameters.membershipExpiresAt = membershipExpiresAt;
    }
    const result = await activateCallable(parameters);
    return result.data;
  }

  async deactivateMembership(uid: string): Promise<{ success: boolean }> {
    const deactivateCallable = httpsCallable<{ uid: string }, { success: boolean }>(
      this.functions,
      'adminDeactivateMembership',
    );

    const result = await deactivateCallable({ uid });
    return result.data;
  }

  async extendMembership(uid: string, newExpirationDate: string): Promise<{ success: boolean }> {
    const extendCallable = httpsCallable<
      { uid: string; newExpirationDate: string },
      { success: boolean }
    >(this.functions, 'adminExtendMembership');

    const result = await extendCallable({ uid, newExpirationDate });
    return result.data;
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
    const listUnclaimedProfilesCallable = httpsCallable<
      { limit?: number; offset?: number },
      ListUnclaimedProfilesResponse
    >(this.functions, 'adminListUnclaimedProfiles');

    const result = await listUnclaimedProfilesCallable({ limit, offset });

    // Convert timestamp objects to Timestamp instances
    const profiles = result.data.profiles.map((profile) =>
      this.convertUnclaimedProfileTimestamps(profile),
    );

    return {
      profiles,
      total: result.data.total,
    };
  }

  async getUnclaimedProfile(email: string): Promise<UnclaimedProfile> {
    const getUnclaimedProfileCallable = httpsCallable<{ email: string }, UnclaimedProfile>(
      this.functions,
      'adminGetUnclaimedProfile',
    );

    const result = await getUnclaimedProfileCallable({ email });
    return this.convertUnclaimedProfileTimestamps(result.data);
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
    const deleteUserCallable = httpsCallable<{ uid: string }, { success: boolean }>(
      this.functions,
      'adminDeleteUser',
    );

    const result = await deleteUserCallable({ uid });
    return result.data;
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

@Injectable({
  providedIn: 'root',
})
export class AdminMatchRequestsService {
  private functions = inject(Functions);

  async listMatchRequests(
    limit = 50,
    offset = 0,
    status: 'pending' | 'processed' | 'all' = 'all',
  ): Promise<ListMatchRequestsResponse> {
    const listMatchRequestsCallable = httpsCallable<
      { limit?: number; offset?: number; status?: 'pending' | 'processed' | 'all' },
      ListMatchRequestsResponse
    >(this.functions, 'adminListMatchRequests');

    const result = await listMatchRequestsCallable({ limit, offset, status });
    return result.data;
  }

  async getMatchRequest(id: string): Promise<MatchRequest> {
    const getMatchRequestCallable = httpsCallable<{ id: string }, MatchRequest>(
      this.functions,
      'adminGetMatchRequest',
    );

    const result = await getMatchRequestCallable({ id });
    return result.data;
  }

  async updateMatchRequestStatus(id: string, sent: boolean): Promise<{ success: boolean }> {
    const updateMatchRequestCallable = httpsCallable<
      { id: string; sent: boolean },
      { success: boolean }
    >(this.functions, 'adminUpdateMatchRequest');

    const result = await updateMatchRequestCallable({ id, sent });
    return result.data;
  }
}
