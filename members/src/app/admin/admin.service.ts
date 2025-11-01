import { inject, Injectable } from '@angular/core';
import { Functions, httpsCallable } from '@angular/fire/functions';
import { Timestamp } from '@angular/fire/firestore';

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
  hasProfile?: boolean;
  slug?: string;
  stripeCustomerId?: string;
  stripeSubscriptionId?: string;
  subscriptionStatus?: SubscriptionStatus;
}

export interface ListMembersResponse {
  members: Member[];
  total: number;
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
    return {
      ...member,
      createdAt: this.toTimestamp(member.createdAt),
      subscriptionStart: member.subscriptionStart ? this.toTimestamp(member.subscriptionStart) : undefined,
      membershipExpiresAt: member.membershipExpiresAt
        ? this.toTimestamp(member.membershipExpiresAt)
        : undefined,
    };
  }

  private toTimestamp(
    value: Timestamp | { seconds: number; nanoseconds: number } | { _seconds: number; _nanoseconds: number },
  ): Timestamp {
    if (value instanceof Timestamp) {
      return value;
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

    const result = await activateCallable({ uid, subscriptionStart, membershipExpiresAt });
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
}
