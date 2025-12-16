/**
 * @deprecated Use ProfileData from profiles-api/schemas/profile-schemas.ts instead.
 * That version is derived from Elysia validation schemas (source of truth).
 *
 * This interface is kept for backward compatibility with legacy callable functions.
 */
export interface ProfileData {
  /** Required: The doula's display name */
  title: string;

  /** Optional: Pronouns (e.g., "she/her", "he/him", "they/them") */
  pronouns?: string;

  /** Optional: Professional credentials (e.g., "CD(DONA), CPD") */
  credentials?: string;

  /** Optional: Array of service tags/specialties */
  tags?: string[];

  /** Optional: Contact information */
  contact?: {
    phone?: string;
    email?: string;
    website?: string;
    business_name?: string;
  };

  /** Required: Bio/description of services */
  bio: string;

  /** Optional: Draft status (read from markdown, preserved on updates, but not set by user input) */
  draft?: boolean;

  /** Optional: Profile image URL (managed separately from markdown content, provided by backend) */
  image?: string;
}
