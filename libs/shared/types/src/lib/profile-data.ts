/**
 * Contact information for a doula profile.
 * Shared between backend (profile API schemas) and frontend (profile display/editing).
 */
export interface ContactInfo {
  phone?: string;
  email?: string;
  website?: string;
  business_name?: string;
}

/**
 * Profile data for doula profiles.
 * Represents the full profile as returned by the API (includes image).
 * Shared between backend (profile API responses) and frontend (profile display/editing).
 */
export interface ProfileData {
  /** Required: The doula's display name */
  title: string;

  /** Required: Bio/description of services */
  bio: string;

  /** Optional: Pronouns (e.g., "she/her", "he/him", "they/them") */
  pronouns?: string;

  /** Optional: Professional credentials (e.g., "CD(DONA), CPD") */
  credentials?: string;

  /** Optional: Array of service tags/specialties */
  tags?: string[];

  /** Optional: Contact information */
  contact?: ContactInfo;

  /** Optional: Draft status (read from markdown, preserved on updates, but not set by user input) */
  draft?: boolean;

  /** Optional: Profile image URL (managed separately from markdown content, provided by backend) */
  image?: string;
}

/**
 * YAML front matter structure from Hugo markdown files.
 * Used by the backend when reading/writing profile markdown files.
 */
export interface ProfileFrontMatter {
  title?: string;
  pronouns?: string;
  credentials?: string;
  tags?: string[];
  contact?: ContactInfo;
  draft?: boolean;
  date?: string;
  createdAt?: string;
  updatedAt?: string;
  type?: string;
}
