/**
 * ProfileData interface for doula profiles.
 * This represents the structure of a doula profile.
 */
export interface ProfileData {
  /** Required: The doula's display name */
  title: string;

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

  /** Optional: Draft status (frontend only - not stored in markdown) */
  draft?: boolean;

  /** Optional: Profile image URL (frontend only - not stored in markdown) */
  image?: string;
}
