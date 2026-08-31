import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Service } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import type {
  ListMembersResponse,
  ListUnclaimedProfilesResponse,
  MemberProfile,
  UnclaimedProfile,
  UnlinkedProfile,
} from '../admin.types';
import type { ApiMemberResponse } from '../../api-types/api-member-response';
import type {
  ApiDraftUnclaimedProfileResponse,
  ApiDraftUnclaimedProfileSuccessResponse,
  ApiListUnclaimedProfilesResponse,
  ApiUnclaimedProfileResponse,
} from '../api-types/admin-unclaimed-profiles-api.types';
import type {
  ApiReadMemberProfileResponse,
  ApiUpdateMemberProfileResponse,
} from '../api-types/admin-member-profile-api.types';
import type { ProfileData } from '../../types/profile-data';
import type {
  ApiListUnlinkedProfilesResponse,
  ApiUnlinkedProfileResponse,
} from '../api-types/admin-unlinked-profiles-api.types';

interface ApiErrorResponse {
  error: string;
}

interface ApiMemberSuccessResponse {
  success: true;
  member: ApiMemberResponse;
}

interface ApiChangeSlugSuccessResponse extends ApiMemberSuccessResponse {
  oldSlug: string;
  newSlug: string;
  imageMoveWarning?: string;
}

type ApiLinkProfileResponse = ApiMemberSuccessResponse | ApiErrorResponse;
type ApiChangeSlugResponse = ApiChangeSlugSuccessResponse | ApiErrorResponse;
type ApiListUnlinkedProfilesResult = ApiListUnlinkedProfilesResponse | ApiErrorResponse;

function isApiErrorResponse(response: unknown): response is ApiErrorResponse {
  return (
    typeof response === 'object' &&
    response !== null &&
    'error' in response &&
    typeof response.error === 'string'
  );
}

function assertApiSuccess<TResponse extends object>(
  response: TResponse | ApiErrorResponse,
): TResponse {
  if (isApiErrorResponse(response)) {
    throw new Error(response.error);
  }

  return response;
}

function toUnlinkedProfile(profile: ApiUnlinkedProfileResponse): UnlinkedProfile {
  return {
    slug: profile.slug,
    title: profile.title,
    email: profile.email,
    createdAt: profile.createdAt,
  };
}

function toUnlinkedProfiles(response: ApiListUnlinkedProfilesResult): UnlinkedProfile[] {
  return assertApiSuccess(response).profiles.map((profile) => toUnlinkedProfile(profile));
}

function toLinkedMember(response: ApiLinkProfileResponse): ApiMemberResponse {
  return assertApiSuccess(response).member;
}

function toChangedSlugResult(response: ApiChangeSlugResponse): {
  member: ApiMemberResponse;
  oldSlug: string;
  newSlug: string;
  imageMoveWarning?: string;
} {
  const result = assertApiSuccess(response);
  return {
    member: result.member,
    oldSlug: result.oldSlug,
    newSlug: result.newSlug,
    ...(result.imageMoveWarning !== undefined && {
      imageMoveWarning: result.imageMoveWarning,
    }),
  };
}

@Service()
export class AdminMembersService {
  private httpClient = inject(HttpClient);

  async listMembers(): Promise<ListMembersResponse> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(this.httpClient.get<ListMembersResponse>('/api/admin/members'));
  }

  async getMember(uid: string): Promise<ApiMemberResponse> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(this.httpClient.get<ApiMemberResponse>(`/api/admin/members/${uid}`));
  }

  async updateMember(
    uid: string,
    updates: Partial<ApiMemberResponse>,
  ): Promise<{ success: boolean }> {
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

  async readMemberProfile(uid: string): Promise<MemberProfile> {
    // Use dedicated admin endpoint that reads directly from Firestore,
    // bypassing the public endpoint's draft access control
    const response = await firstValueFrom(
      this.httpClient.get<ApiReadMemberProfileResponse>(`/api/admin/members/${uid}/profile`),
    );

    return this.toMemberProfile(response.profile, response.slug);
  }

  async updateMemberProfile(uid: string, profileData: ProfileData): Promise<MemberProfile> {
    const response = await firstValueFrom(
      this.httpClient.put<ApiUpdateMemberProfileResponse>(
        `/api/admin/members/${uid}/profile`,
        profileData,
      ),
    );

    return this.toMemberProfile(response.profile, response.slug);
  }

  async uploadMemberProfileImage(slug: string, imageData: string, mimeType: string): Promise<void> {
    await firstValueFrom(
      this.httpClient.post<{ success: boolean; url: string }>(`/api/profiles/${slug}/image`, {
        imageData,
        mimeType,
      }),
    );
  }

  async deleteMemberProfileImage(slug: string): Promise<void> {
    await firstValueFrom(
      this.httpClient.delete<{ success: boolean }>(`/api/profiles/${slug}/image`),
    );
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

    const profiles = result.profiles.map((profile) => this.convertUnclaimedProfileDates(profile));

    return {
      profiles,
      total: result.total,
    };
  }

  private toMemberProfile(profile: ProfileData, slug: string): MemberProfile {
    return {
      title: profile.title,
      bio: profile.bio,
      ...(profile.credentials !== undefined && { credentials: profile.credentials }),
      ...(profile.pronouns !== undefined && { pronouns: profile.pronouns }),
      ...(profile.tags !== undefined && { tags: profile.tags }),
      ...(profile.contact !== undefined && { contact: profile.contact }),
      ...(profile.draft !== undefined && { draft: profile.draft }),
      ...(profile.image !== undefined && { image: profile.image }),
      slug,
    };
  }

  async getUnclaimedProfile(email: string): Promise<UnclaimedProfile> {
    // Authorization header added automatically by authInterceptor
    const result = await firstValueFrom(
      this.httpClient.get<ApiUnclaimedProfileResponse>(`/api/admin/unclaimed-profiles/${email}`),
    );
    return this.convertUnclaimedProfileDates(result);
  }

  private convertUnclaimedProfileDates(profile: ApiUnclaimedProfileResponse): UnclaimedProfile {
    try {
      const result: UnclaimedProfile = {
        email: profile.email,
        name: profile.name,
        subscriptionStart: new Date(profile.subscriptionStart),
        ...(profile.slug !== undefined && { slug: profile.slug }),
        ...(profile.lastPayment !== undefined && {
          lastPayment: new Date(profile.lastPayment),
        }),
        ...(profile.nextPayment !== undefined && {
          nextPayment: new Date(profile.nextPayment),
        }),
      };

      return result;
    } catch (error) {
      console.error(
        `Error converting dates for unclaimed profile: ${profile.name} (${profile.email})`,
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

  async draftUnclaimedProfile(email: string): Promise<ApiDraftUnclaimedProfileSuccessResponse> {
    // Authorization header added automatically by authInterceptor
    const result = await firstValueFrom(
      this.httpClient.post<ApiDraftUnclaimedProfileResponse>(
        `/api/admin/unclaimed-profiles/${email}/draft`,
        {},
      ),
    );

    return assertApiSuccess(result);
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

  async deleteDraftProfile(uid: string): Promise<{
    success: boolean;
    slug: string;
    profileDeleted: boolean;
    profileImageDeleted: boolean;
    memberUpdated: boolean;
    warning?: string;
  }> {
    // Authorization header added automatically by authInterceptor
    return firstValueFrom(
      this.httpClient.post<{
        success: boolean;
        slug: string;
        profileDeleted: boolean;
        profileImageDeleted: boolean;
        memberUpdated: boolean;
        warning?: string;
      }>(`/api/admin/members/${uid}/profile/delete-draft`, {}),
    );
  }

  async listUnlinkedProfiles(): Promise<UnlinkedProfile[]> {
    // Authorization header added automatically by authInterceptor
    const response = await firstValueFrom(
      this.httpClient.get<ApiListUnlinkedProfilesResult>('/api/admin/members/unlinked-profiles'),
    );

    return toUnlinkedProfiles(response);
  }

  async linkProfile(uid: string, slug: string): Promise<ApiMemberResponse> {
    // Authorization header added automatically by authInterceptor
    const response = await firstValueFrom(
      this.httpClient.post<ApiLinkProfileResponse>(`/api/admin/members/${uid}/profile/link`, {
        slug,
      }),
    );

    return toLinkedMember(response);
  }

  async changeSlug(
    uid: string,
    newSlug: string,
  ): Promise<{
    member: ApiMemberResponse;
    oldSlug: string;
    newSlug: string;
    imageMoveWarning?: string;
  }> {
    // Authorization header added automatically by authInterceptor
    const response = await firstValueFrom(
      this.httpClient.post<ApiChangeSlugResponse>(`/api/admin/members/${uid}/profile/change-slug`, {
        newSlug,
      }),
    );

    return toChangedSlugResult(response);
  }
}
