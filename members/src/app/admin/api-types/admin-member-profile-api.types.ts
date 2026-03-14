import type { ProfileData } from '../../types/profile-data';

/**
 * Profile content returned by the admin member profile API.
 * Mirrors ProfileContentSchema in the admin-members API.
 */
export interface ApiAdminMemberProfileContent extends ProfileData {
  createdAt: string;
  updatedAt: string;
  ownerUid?: string;
}

/**
 * Success response from GET /api/admin/members/:memberId/profile.
 * Mirrors ReadProfileResponse in the admin-members API.
 */
export interface ApiReadMemberProfileResponse {
  success: true;
  slug: string;
  profile: ApiAdminMemberProfileContent;
}
