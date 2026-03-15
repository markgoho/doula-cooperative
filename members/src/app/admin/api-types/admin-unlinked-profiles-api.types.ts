/**
 * API response types for the admin unlinked profiles endpoints.
 * All timestamp fields are ISO 8601 strings.
 *
 * IMPORTANT: These types mirror the Elysia schemas defined in:
 * functions/src/admin-members-api/schemas/member-schemas.ts
 *
 * When updating the Elysia schemas, update these types to match.
 */

/**
 * An unlinked profile from the API with ISO 8601 timestamp strings.
 * Mirrors: UnlinkedProfileSchema
 */
export interface ApiUnlinkedProfileResponse {
  slug: string;
  title: string;
  email: string;
  createdAt: string; // ISO 8601
}

/**
 * List unlinked profiles response from the API.
 * Mirrors: ListUnlinkedProfilesResponseSchema
 */
export interface ApiListUnlinkedProfilesResponse {
  profiles: ApiUnlinkedProfileResponse[];
}
