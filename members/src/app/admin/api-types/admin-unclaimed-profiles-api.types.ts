/**
 * API response types for the admin-unclaimed-profiles-api Elysia endpoints.
 * All timestamp fields are ISO 8601 strings.
 *
 * IMPORTANT: These types mirror the Elysia schemas defined in:
 * functions/src/admin-unclaimed-profiles-api/schemas/unclaimed-profile-schemas.ts
 *
 * When updating the Elysia schemas, update these types to match.
 */

/**
 * Unclaimed profile response from the API with ISO 8601 timestamp strings.
 * Mirrors: UnclaimedProfileResponse (from UnclaimedProfileResponseSchema)
 */
export interface ApiUnclaimedProfileResponse {
  email: string;
  name: string;
  subscriptionStart: string; // ISO 8601
  lastPayment: string; // ISO 8601
  nextPayment: string; // ISO 8601
  slug?: string;
  createdAt?: string; // ISO 8601
  updatedAt?: string; // ISO 8601
}

/**
 * List unclaimed profiles response from the API.
 * Mirrors: ListUnclaimedProfilesResponse (from ListUnclaimedProfilesResponseSchema)
 */
export interface ApiListUnclaimedProfilesResponse {
  profiles: ApiUnclaimedProfileResponse[];
  total: number;
}

export interface ApiDraftUnclaimedProfileResponse {
  success: true;
  slug: string;
  warning?: string;
}
